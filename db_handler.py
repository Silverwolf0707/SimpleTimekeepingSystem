import json
from pathlib import Path

DB_FILE = Path("db.json")

def load_entries():
    if DB_FILE.exists():
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return []

def save_entries(entries):
    with open(DB_FILE, "w") as f:
        json.dump(entries, f, indent=4)
