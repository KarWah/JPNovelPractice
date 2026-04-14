"""
KANJIDIC2 Import Script
=======================
Downloads kanjidic2-simplified (JSON edition of KANJIDIC2) and imports every
kanji character into the KanjiEntry table.

Fills in: onyomi, kunyomi, English meanings, stroke count, JLPT level,
school grade, and newspaper frequency rank.

Usage:
  python scripts/kanjidic_import.py

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
CACHE_FILE = CACHE_DIR / "kanjidic2.json"

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
    req = urllib.request.Request(
        GITHUB_API,
        headers={"User-Agent": "seishun-srs-kanjidic-script"},
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


# ── Download ──────────────────────────────────────────────────────────────────

def ensure_kanjidic():
    CACHE_DIR.mkdir(exist_ok=True)

    if CACHE_FILE.exists():
        print(f"Using cached KANJIDIC2: {CACHE_FILE.name}")
        return

    print("Resolving latest KANJIDIC2 release ...")
    url = get_latest_asset_url("kanjidic2-en-")
    zip_path = CACHE_DIR / "kanjidic2.json.zip"

    print(f"Downloading {url} ...")
    urllib.request.urlretrieve(url, zip_path)

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        json_name = next((n for n in names if n.endswith(".json")), None)
        if not json_name:
            sys.exit("ERROR: No JSON found inside the ZIP.")
        with zf.open(json_name) as src, open(CACHE_FILE, "wb") as dst:
            dst.write(src.read())

    zip_path.unlink()
    print(f"Saved to {CACHE_FILE}")


def load_kanjidic() -> dict:
    print("Loading KANJIDIC2 ...")
    with open(CACHE_FILE, encoding="utf-8") as f:
        return json.load(f)


# ── JLPT mapping ─────────────────────────────────────────────────────────────
# kanjidic2-simplified stores jlpt as integer: 1=N5, 2=N4, 3=N3, 4=N2
# (N1 kanji are not tagged in KANJIDIC2)
_JLPT_INT_MAP = {1: "N5", 2: "N4", 3: "N3", 4: "N2"}

def jlpt_from_entry(entry: dict) -> str | None:
    misc = entry.get("misc", {})
    if "jlptLevel" in misc:
        lvl = misc["jlptLevel"]
        if isinstance(lvl, int):
            return _JLPT_INT_MAP.get(lvl)
        if isinstance(lvl, str) and lvl.startswith("N"):
            return lvl
    return None


# ── Import ────────────────────────────────────────────────────────────────────

def import_kanjidic(kanjidic: dict):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    characters = kanjidic.get("characters", [])
    print(f"Importing {len(characters)} kanji characters ...")

    batch = []
    for entry in characters:
        char = entry.get("literal", "")
        if not char:
            continue

        readings = entry.get("readings", {})
        onyomi  = readings.get("ja_on", [])
        kunyomi = readings.get("ja_kun", [])

        meanings_map = entry.get("meanings", {})
        meanings = meanings_map.get("en", [])

        misc = entry.get("misc", {})
        stroke_counts = misc.get("strokeCounts", [])
        stroke_count = stroke_counts[0] if stroke_counts else None
        grade = misc.get("grade")
        freq  = misc.get("frequency")
        jlpt  = jlpt_from_entry(entry)

        batch.append((char, onyomi, kunyomi, meanings, stroke_count, jlpt, grade, freq))

    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO "KanjiEntry"
            (character, onyomi, kunyomi, meanings, "strokeCount", "jlptLevel", grade, frequency)
        VALUES %s
        ON CONFLICT (character) DO UPDATE SET
            onyomi        = EXCLUDED.onyomi,
            kunyomi       = EXCLUDED.kunyomi,
            meanings      = EXCLUDED.meanings,
            "strokeCount" = EXCLUDED."strokeCount",
            "jlptLevel"   = EXCLUDED."jlptLevel",
            grade         = EXCLUDED.grade,
            frequency     = EXCLUDED.frequency
        """,
        batch,
        template="(%s, %s, %s, %s, %s, %s, %s, %s)",
    )

    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {len(batch)} kanji into KanjiEntry.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ensure_kanjidic()
    kanjidic = load_kanjidic()
    import_kanjidic(kanjidic)
    print("Done!")
