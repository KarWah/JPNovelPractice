"""
JPDB Vocabulary Scraper
=======================
Scrapes a vocabulary list from jpdb.io and writes the result to a JSON file.

Usage:
  python Scrape.py --url <jpdb-url> --output <output-path>

Progress is emitted as JSON lines to stdout:
  {"type": "progress", "scraped": N, "offset": X}
  {"type": "done",     "count":   N, "path": "..."}
  {"type": "error",    "message": "..."}

Requirements:
  pip install requests beautifulsoup4
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Force UTF-8 output (prevents Windows cp1252 crashes)
sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/Browser"
    )
}
POLITE_DELAY = 1.5  # seconds between requests


def emit(obj: dict) -> None:
    """Write a single JSON progress line to stdout and flush immediately."""
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def scrape_vocab(base_url: str) -> tuple[list[dict], int | None]:
    all_vocab: list[dict] = []
    offset = 0
    total_count: int | None = None

    # First request: get total count from pagination
    first_response = requests.get(base_url, headers=HEADERS)
    if first_response.status_code != 200:
        emit({"type": "error", "message": f"HTTP {first_response.status_code} at offset 0"})
        sys.exit(1)

    first_soup = BeautifulSoup(first_response.content, "html.parser")

    # Try to find total count in pagination info (e.g., "1-50 of 1,234")
    pagination_text = first_soup.select_one(".pagination-info, .results-info, [class*='total']")
    if pagination_text:
        import re
        match = re.search(r"of\s*([\d,]+)", pagination_text.text)
        if match:
            total_count = int(match.group(1).replace(",", ""))

    # Process first page
    vocab_list = first_soup.select_one(".vocabulary-list")
    if not vocab_list:
        return all_vocab, total_count

    entries = vocab_list.find_all("div", recursive=False)
    for index, entry in enumerate(entries):
        try:
            spelling_box = entry.select_one(".vocabulary-spelling a")
            if not spelling_box:
                continue

            spelling = " ".join(spelling_box.text.split())

            spelling_container = entry.select_one(".vocabulary-spelling")
            meaning_div = spelling_container.find_next_sibling("div")
            meaning = " ".join(meaning_div.text.split()) if meaning_div else "No definition"

            occurrence_div = entry.select_one('div[style*="opacity: 0.5"]')
            occurrences = int(occurrence_div.text.strip()) if occurrence_div else 0

            all_vocab.append({
                "spelling": spelling,
                "meaning": meaning,
                "occurrences": occurrences,
            })
        except Exception as exc:
            sys.stderr.write(f"Skipping entry {index} at offset {offset}: {exc}\n")
            continue

    emit({"type": "progress", "scraped": len(all_vocab), "total": total_count})
    offset += 50
    time.sleep(POLITE_DELAY)

    # Continue with remaining pages
    while True:
        url = f"{base_url}?offset={offset}"
        response = requests.get(url, headers=HEADERS)

        if response.status_code != 200:
            break

        soup = BeautifulSoup(response.content, "html.parser")
        vocab_list = soup.select_one(".vocabulary-list")

        if not vocab_list:
            break

        entries = vocab_list.find_all("div", recursive=False)
        if not entries:
            break

        for index, entry in enumerate(entries):
            try:
                spelling_box = entry.select_one(".vocabulary-spelling a")
                if not spelling_box:
                    continue

                spelling = " ".join(spelling_box.text.split())

                spelling_container = entry.select_one(".vocabulary-spelling")
                meaning_div = spelling_container.find_next_sibling("div")
                meaning = " ".join(meaning_div.text.split()) if meaning_div else "No definition"

                occurrence_div = entry.select_one('div[style*="opacity: 0.5"]')
                occurrences = int(occurrence_div.text.strip()) if occurrence_div else 0

                all_vocab.append({
                    "spelling": spelling,
                    "meaning": meaning,
                    "occurrences": occurrences,
                })
            except Exception as exc:
                sys.stderr.write(f"Skipping entry {index} at offset {offset}: {exc}\n")
                continue

        emit({"type": "progress", "scraped": len(all_vocab), "total": total_count})

        offset += 50
        time.sleep(POLITE_DELAY)

    return all_vocab, total_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape vocabulary from jpdb.io")
    parser.add_argument("--url",    required=True, help="Full JPDB vocabulary list URL")
    parser.add_argument("--output", required=True, help="Path for the output JSON file")
    args = parser.parse_args()

    if not args.url.startswith("https://jpdb.io/"):
        emit({"type": "error", "message": "URL must start with https://jpdb.io/"})
        sys.exit(1)

    base_url = args.url.split("?")[0]

    vocab, total_count = scrape_vocab(base_url)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    emit({"type": "done", "count": len(vocab), "total": total_count})


if __name__ == "__main__":
    main()
