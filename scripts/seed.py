"""Başlangıç verisi: HSD toplulukları ve kategoriler.

Kullanım:  python scripts/seed.py
Veriler scripts/data/*.csv dosyalarından okunur. Script tekrar çalıştırılabilir:
zaten var olan kayıtlar atlanır (ON CONFLICT DO NOTHING).
"""

import csv
from pathlib import Path

from db import get_connection, new_id

DATA_DIR = Path(__file__).resolve().parent / "data"


def read_csv(name: str) -> list[dict]:
    with (DATA_DIR / name).open(encoding="utf-8", newline="") as file:
        return [
            {key: (value or "").strip() for key, value in row.items()}
            for row in csv.DictReader(file)
            if any((value or "").strip() for value in row.values())
        ]


def seed_communities(cur) -> int:
    rows = read_csv("hsd_communities.csv")
    added = 0
    for row in rows:
        cur.execute(
            """
            INSERT INTO hsd_communities (id, name, university, city)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (name) DO NOTHING
            """,
            (row.get("id") or new_id(), row["name"], row["university"], row["city"]),
        )
        added += cur.rowcount
    return added


def seed_categories(cur) -> int:
    rows = read_csv("categories.csv")
    added = 0
    for row in rows:
        cur.execute(
            """
            INSERT INTO categories (id, name, slug)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (new_id(), row["name"], row["slug"]),
        )
        added += cur.rowcount
    return added


def main():
    with get_connection() as conn, conn.cursor() as cur:
        communities = seed_communities(cur)
        categories = seed_categories(cur)
        cur.execute("SELECT (SELECT COUNT(*) FROM hsd_communities), (SELECT COUNT(*) FROM categories)")
        total_communities, total_categories = cur.fetchone()

    print(f"Topluluklar: {communities} eklendi (toplam {total_communities})")
    print(f"Kategoriler: {categories} eklendi (toplam {total_categories})")


if __name__ == "__main__":
    main()
