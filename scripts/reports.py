
from db import get_connection


def get_table_count(cur, table_name):
    allowed_tables = {
        "users",
        "hsd_communities",
        "categories",
        "quizzes",
        "questions",
        "options",
        "quiz_attempts",
        "posts",
    }

    if table_name not in allowed_tables:
        raise ValueError("Geçersiz tablo adı.")

    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    return cur.fetchone()[0]


def generate_report():
    with get_connection() as conn:
        with conn.cursor() as cur:

            print("\n========== HSDCode+ DATA REPORT ==========\n")

            tables = {
                "Toplam Kullanıcı": "users",
                "Toplam Topluluk": "hsd_communities",
                "Toplam Kategori": "categories",
                "Toplam Test": "quizzes",
                "Toplam Soru": "questions",
                "Toplam Seçenek": "options",
                "Toplam Test Katılımı": "quiz_attempts",
                "Toplam Gönderi": "posts",
            }

            print("--- GENEL İSTATİSTİKLER ---")

            for label, table in tables.items():
                count = get_table_count(cur, table)
                print(f"{label}: {count}")

            print("\n--- TEST İSTATİSTİKLERİ ---")

            cur.execute("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE "isPublished" = TRUE
                    ) AS published,
                    COUNT(*) FILTER (
                        WHERE "isPublished" = FALSE
                    ) AS unpublished
                FROM quizzes
            """)

            total, published, unpublished = cur.fetchone()

            print(f"Toplam Test: {total}")
            print(f"Yayımlanmış Test: {published}")
            print(f"Yayımlanmamış Test: {unpublished}")

            print("\n--- KATEGORİ BAZLI TEST DAĞILIMI ---")

            cur.execute("""
                SELECT
                    c.name,
                    COUNT(q.id) AS quiz_count
                FROM categories c
                LEFT JOIN quizzes q
                    ON q."categoryId" = c.id
                GROUP BY c.id, c.name
                ORDER BY quiz_count DESC, c.name ASC
            """)

            for category, count in cur.fetchall():
                print(f"{category}: {count} test")

            print("\n--- KULLANICI DURUM DAĞILIMI ---")

            cur.execute("""
                SELECT
                    status,
                    COUNT(*) AS user_count
                FROM users
                GROUP BY status
                ORDER BY status
            """)

            for status, count in cur.fetchall():
                print(f"{status}: {count} kullanıcı")

            print("\n==========================================")
            print("Rapor başarıyla oluşturuldu.\n")


if __name__ == "__main__":
    generate_report()