
import csv
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "Data"
DATABASE_PATH = DATA_DIR / "pinspire.db"
METADATA_PATH = DATA_DIR / "metadata.csv"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS images (
                image_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                category TEXT,
                label TEXT,
                source_dataset TEXT,
                source_url TEXT,
                license TEXT
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS click_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                visitor_id TEXT NOT NULL,
                image_id TEXT NOT NULL,
                clicked_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (image_id) REFERENCES images(image_id)
            )
        """)

        if not METADATA_PATH.exists():
            raise FileNotFoundError(
                f"Metadata file not found: {METADATA_PATH}"
            )

        with open(
            METADATA_PATH, "r", encoding="utf-8-sig", newline=""
        ) as file:
            reader = csv.DictReader(file)

            for row in reader:
                connection.execute("""
                    INSERT OR REPLACE INTO images (
                        image_id, filename, category, label,
                        source_dataset, source_url, license
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row.get("image_id", "")),
                    row.get("filename", ""),
                    row.get("category", ""),
                    row.get("label", ""),
                    row.get("source_dataset", ""),
                    row.get("source_url", ""),
                    row.get("license", "")
                ))

        connection.commit()

        count = connection.execute(
            "SELECT COUNT(*) FROM images"
        ).fetchone()[0]

    print(f"SQLite database ready. Image records: {count}")
