
import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

CATEGORIES = [
    ("Yazılım", "yazilim"),
    ("Yapay Zeka", "yapay-zeka"),
    ("Veri Bilimi", "veri-bilimi"),
    ("Siber Güvenlik", "siber-guvenlik"),
    ("Kariyer", "kariyer"),
] #Bu liste ihtiyaca göre güncellenebilir ve genişletilebilir.


def seed_categories():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL .env dosyasında bulunamadı.")

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO categories (name, slug)
                VALUES (%s, %s)
                ON CONFLICT (slug) DO NOTHING
                """,
                CATEGORIES,
            )

            cur.execute("SELECT COUNT(*) FROM categories")
            total = cur.fetchone()[0]

    print(f"Seed tamamlandı. Toplam kategori sayısı: {total}")


if __name__ == "__main__":
    seed_categories()
