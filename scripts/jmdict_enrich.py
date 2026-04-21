"""
JMdict Enrichment Script
========================
Downloads jmdict-simplified (JSON edition of JMdict) and:

  Phase 1 — enriches every VocabEntry with:
    jmdictId, jlptLevel, partsOfSpeech, allReadings, allMeanings, tags

  Phase 2 — imports example sentences from jmdict-examples-eng into
    the ExampleSentence table (skips entries that already have sentences).

Usage:
  python scripts/jmdict_enrich.py              # phase 1 only
  python scripts/jmdict_enrich.py --examples   # phase 1 + phase 2

Requirements:
  pip install psycopg2-binary
"""

import json
import os
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

import psycopg2
import psycopg2.extras

# ── Config ────────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest"
CACHE_DIR  = Path(__file__).parent / ".cache"

ENV_FILE = Path(__file__).parent.parent / "seishun-srs-app" / ".env"
DATABASE_URL = None

if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            DATABASE_URL = line.split("=", 1)[1].strip().strip('"')
            break

if not DATABASE_URL:
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:localpassword@localhost:5432/seishun_db",
    )

# psycopg2 doesn't understand Prisma's ?schema= parameter — strip it
if DATABASE_URL and "?schema=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?schema=")[0]

# ── GitHub release resolver ───────────────────────────────────────────────────

def get_latest_asset_url(name_contains: str, name_ends: str = ".json.zip") -> str:
    """Query the GitHub API and return the download URL for the first asset
    whose name contains `name_contains` and ends with `name_ends`."""
    req = urllib.request.Request(
        GITHUB_API,
        headers={"User-Agent": "seishun-srs-enrichment-script"},
    )
    with urllib.request.urlopen(req) as resp:
        release = json.loads(resp.read())

    for asset in release.get("assets", []):
        name = asset["name"]
        if name_contains in name and name.endswith(name_ends):
            return asset["browser_download_url"]

    available = [a["name"] for a in release.get("assets", [])]
    sys.exit(
        f"ERROR: No asset matching '{name_contains}' + '{name_ends}' found.\n"
        f"Available: {available}"
    )


# ── Download helpers ──────────────────────────────────────────────────────────

def download_and_extract(url: str, cache_path: Path) -> None:
    """Download a .zip from `url`, extract the first .json inside, save to cache_path."""
    CACHE_DIR.mkdir(exist_ok=True)
    zip_path = cache_path.with_suffix(".zip")

    print(f"  Downloading {url} ...")
    urllib.request.urlretrieve(url, zip_path)

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        json_name = next((n for n in names if n.endswith(".json")), None)
        if not json_name:
            sys.exit(f"ERROR: No JSON found inside {zip_path.name}")
        with zf.open(json_name) as src, open(cache_path, "wb") as dst:
            dst.write(src.read())

    zip_path.unlink()
    print(f"  Saved to {cache_path}")


def ensure_file(cache_path: Path, asset_pattern: str) -> None:
    if cache_path.exists():
        print(f"Using cached: {cache_path.name}")
        return
    print(f"Resolving latest release asset matching '{asset_pattern}' ...")
    url = get_latest_asset_url(asset_pattern)
    download_and_extract(url, cache_path)


# ── JMdict loading ────────────────────────────────────────────────────────────

JMDICT_CACHE = CACHE_DIR / "jmdict-eng.json"

def load_jmdict() -> dict:
    ensure_file(JMDICT_CACHE, "jmdict-eng-")
    print("Loading JMdict into memory ...")
    with open(JMDICT_CACHE, encoding="utf-8") as f:
        return json.load(f)


# ── Index building ────────────────────────────────────────────────────────────

def build_indexes(jmdict: dict):
    by_kanji: dict[str, list] = {}
    by_kana:  dict[str, list] = {}
    by_id:    dict[str, dict] = {}

    for entry in jmdict["words"]:
        by_id[entry["id"]] = entry
        for k in entry.get("kanji", []):
            by_kanji.setdefault(k.get("text", ""), []).append(entry)
        for r in entry.get("kana", []):
            by_kana.setdefault(r.get("text", ""), []).append(entry)

    return by_kanji, by_kana, by_id


# ── Info extraction ───────────────────────────────────────────────────────────

def extract_info(jm_entry: dict) -> dict:
    all_readings = [r["text"] for r in jm_entry.get("kana", [])]

    pos_set: set[str] = set()
    tag_set: set[str] = set()
    all_meanings: list[str] = []

    for sense in jm_entry.get("sense", []):
        for pos in sense.get("partOfSpeech", []):
            pos_set.add(pos)
        for m in sense.get("misc", []):
            tag_set.add(m)
        glosses = [g["text"] for g in sense.get("gloss", []) if g.get("lang") == "eng"]
        if glosses:
            text = "; ".join(glosses)
            pos_labels = sense.get("partOfSpeech", [])
            if pos_labels:
                text = f"({', '.join(pos_labels)}) {text}"
            all_meanings.append(text)

    # JLPT level from tags on kanji/kana forms
    jlpt = None
    for form_list in (jm_entry.get("kanji", []), jm_entry.get("kana", [])):
        for form in form_list:
            for tag in form.get("tags", []):
                m = re.match(r"jlpt-n(\d)", tag)
                if m:
                    jlpt = f"N{m.group(1)}"
                    break
            if jlpt:
                break
        if jlpt:
            break

    return {
        "jmdictId":     int(jm_entry["id"]),
        "allReadings":  all_readings,
        "partsOfSpeech": sorted(pos_set),
        "allMeanings":  all_meanings,
        "tags":         sorted(tag_set),
        "jlptLevel":    jlpt,
    }


def _prefer_common(candidates: list, search_text: str, form_key: str) -> list:
    """Narrow candidates to those where search_text appears as a common form."""
    common = [
        e for e in candidates
        if any(f["text"] == search_text and f.get("common", False)
               for f in e.get(form_key, []))
    ]
    return common if common else candidates


def find_best_match(kanji, kana, by_kanji, by_kana):
    candidates = []

    if kanji:
        candidates = by_kanji.get(kanji, [])
        if len(candidates) > 1 and kana:
            filtered = [
                e for e in candidates
                if any(r["text"] == kana for r in e.get("kana", []))
            ]
            if filtered:
                candidates = filtered
        if len(candidates) > 1:
            candidates = _prefer_common(candidates, kanji, "kanji")

    if not candidates:
        # kana field may contain kanji (e.g. "言う") — try kanji index first
        candidates = by_kanji.get(kana, [])
        if len(candidates) > 1:
            candidates = _prefer_common(candidates, kana, "kanji")

    if not candidates:
        candidates = by_kana.get(kana, [])
        if len(candidates) > 1:
            # Prefer entries where the searched kana is the *primary* (first) reading,
            # not just any reading.  Without this filter a word like "この" (kono)
            # could accidentally match 九 (nine) whose readings are
            # ["きゅう","く","ここの","この","ここ"] — "この" appears but is not primary.
            primary = [e for e in candidates
                       if e.get("kana", [{}])[0].get("text") == kana]
            if primary:
                candidates = primary
        if len(candidates) > 1:
            candidates = _prefer_common(candidates, kana, "kana")

    return candidates[0] if candidates else None


# ── Phase 1: enrich VocabEntry ────────────────────────────────────────────────

def enrich_vocab(by_kanji, by_kana):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute('SELECT id, kanji, kana FROM "VocabEntry"')
    rows = cur.fetchall()
    print(f"Phase 1: enriching {len(rows)} vocab entries ...")

    matched = 0
    for row in rows:
        entry_id, kanji, kana = row["id"], row["kanji"], row["kana"]
        jm = find_best_match(kanji, kana, by_kanji, by_kana)
        if not jm:
            continue

        info = extract_info(jm)
        cur.execute(
            """
            UPDATE "VocabEntry" SET
                "jmdictId"       = %s,
                "jlptLevel"      = %s,
                "partsOfSpeech"  = %s,
                "allReadings"    = %s,
                "allMeanings"    = %s,
                "tags"           = %s
            WHERE id = %s
            """,
            (
                info["jmdictId"], info["jlptLevel"], info["partsOfSpeech"],
                info["allReadings"], info["allMeanings"], info["tags"],
                entry_id,
            ),
        )
        matched += 1

    conn.commit()
    cur.close()
    conn.close()
    pct = round(matched / len(rows) * 100) if rows else 0
    print(f"  Enriched {matched}/{len(rows)} entries ({pct}% match rate).")


# ── Phase 2: import example sentences ────────────────────────────────────────

EXAMPLES_CACHE = CACHE_DIR / "jmdict-examples-eng.json"

def import_examples(by_id: dict[str, dict]):
    ensure_file(EXAMPLES_CACHE, "jmdict-examples-eng-")

    print("Phase 2: loading example sentences ...")
    with open(EXAMPLES_CACHE, encoding="utf-8") as f:
        examples_data = json.load(f)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Build jmdictId → vocabEntry.id mapping (only entries that have been enriched)
    cur.execute('SELECT id, "jmdictId" FROM "VocabEntry" WHERE "jmdictId" IS NOT NULL')
    jmdict_to_vocab: dict[int, int] = {row["jmdictId"]: row["id"] for row in cur.fetchall()}

    # Find entries that already have sentences so we don't duplicate
    cur.execute('SELECT "vocabId" FROM "ExampleSentence"')
    already_has_sentences: set[int] = {row["vocabId"] for row in cur.fetchall()}

    inserted = 0
    skipped = 0

    for word_entry in examples_data.get("words", []):
        jmdict_id = int(word_entry["id"])
        vocab_id = jmdict_to_vocab.get(jmdict_id)
        if not vocab_id:
            continue
        if vocab_id in already_has_sentences:
            skipped += 1
            continue

        # Examples are inside sense[].examples, not at the word level
        collected: list[tuple[str, str]] = []
        for sense in word_entry.get("sense", []):
            for ex in sense.get("examples", []):
                sentences = ex.get("sentences", [])
                jpn = next((s["text"] for s in sentences if s["lang"] == "jpn"), None)
                eng = next((s["text"] for s in sentences if s["lang"] == "eng"), None)
                if jpn and eng:
                    collected.append((jpn, eng))
                if len(collected) >= 3:
                    break
            if len(collected) >= 3:
                break

        for jpn, eng in collected:
            cur.execute(
                'INSERT INTO "ExampleSentence" ("japaneseText", "englishTrans", "vocabId") VALUES (%s, %s, %s)',
                (jpn, eng, vocab_id),
            )
            inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"  Inserted {inserted} example sentences ({skipped} entries already had sentences).")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import_ex = "--examples" in sys.argv

    jmdict = load_jmdict()
    by_kanji, by_kana, by_id = build_indexes(jmdict)
    enrich_vocab(by_kanji, by_kana)

    if import_ex:
        import_examples(by_id)
    else:
        print("\nTip: run with --examples to also import Tatoeba example sentences.")

    print("Done!")
