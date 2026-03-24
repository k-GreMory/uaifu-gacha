from cards_data import CARDS
from collections import Counter

names = [c["name"] for c in CARDS]
counts = Counter(names)
duplicates = {name: count for name, count in counts.items() if count > 1}

if duplicates:
    print("Found duplicate names in CARDS:")
    for name, count in duplicates.items():
        rarities = [c["rarity"] for c in CARDS if c["name"] == name]
        ids = [c["id"] for c in CARDS if c["name"] == name]
        print(f"Name: {name}, Count: {count}, Rarities: {rarities}, IDs: {ids}")
else:
    print("No duplicate names found in CARDS.")
