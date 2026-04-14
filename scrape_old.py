import requests

from bs4 import BeautifulSoup

import time

import json

import sys


# Force Python to use UTF-8 (helps prevent Windows terminal crashes)

sys.stdout.reconfigure(encoding='utf-8')


BASE_URL = "https://jpdb.io/novel/3906/seishun-buta-yarou-series/vocabulary-list"

HEADERS = {

    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

}


def scrape_vocab():

    all_vocab = []

    offset = 0

    

    while True:

        print(f"Scraping offset: {offset}...")

        response = requests.get(f"{BASE_URL}?offset={offset}", headers=HEADERS)

        

        if response.status_code != 200:

            print(f"Error: Received status code {response.status_code}")

            break

            

        soup = BeautifulSoup(response.content, 'html.parser')

        

        # Find the main vocabulary container first

        vocab_list = soup.select_one('.vocabulary-list')

        if not vocab_list:

            print("Could not find the vocabulary list container. Finishing...")

            break

            

        # Get all direct children divs (the entries)

        entries = vocab_list.find_all('div', recursive=False)

        

        if not entries:

            print("No more entries found. Finishing...")

            break

            

        for index, entry in enumerate(entries):

            try:

                # 1. Spelling (Kanji/Kana inside the ruby tag)

                spelling_box = entry.select_one('.vocabulary-spelling a')

                if not spelling_box:

                    continue # Skip if it's not a real word entry

                

                # ' '.join(.split()) cleans up the messy newlines from the HTML

                spelling = " ".join(spelling_box.text.split())

                

                # 2. Meaning (The div immediately following the spelling box)

                spelling_container = entry.select_one('.vocabulary-spelling')

                meaning_div = spelling_container.find_next_sibling('div')

                meaning = " ".join(meaning_div.text.split()) if meaning_div else "No definition"

                

                # 3. Occurrences (The div with opacity: 0.5)

                occurrence_div = entry.select_one('div[style*="opacity: 0.5"]')

                occurrences = int(occurrence_div.text.strip()) if occurrence_div else 0


                all_vocab.append({

                    "spelling": spelling,

                    "meaning": meaning,

                    "occurrences": occurrences

                })

                

            except Exception as e:

                print(f"Skipping entry {index} at offset {offset} due to error: {e}")

                continue

            

        offset += 50

        time.sleep(1.5) # Polite delay

        

    return all_vocab


# Run the scraper

vocab_data = scrape_vocab()


# Save to JSON

with open('seishun_buta_vocab.json', 'w', encoding='utf-8') as f:

    json.dump(vocab_data, f, ensure_ascii=False, indent=4)


print(f"Done! Successfully extracted {len(vocab_data)} words.") 