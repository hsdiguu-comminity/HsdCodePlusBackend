
import argparse

from db import get_connection


TEST_QUIZ_TITLE = "Python Temelleri - Deneme"
TEST_CREATOR_EMAIL = "quiz-test@localhost.invalid"


def cleanup_test_quiz(confirm=False):
    with get_connection() as conn:
        with conn.cursor() as cur:

            # Yalnızca belirlediğimiz test kullanıcısını bul.
            cur.execute(
                """
                SELECT id
                FROM users
                WHERE email = %s
                """,
                (TEST_CREATOR_EMAIL,),
            )
            creator = cur.fetchone()

            if creator is None:
                print("Test kullanıcısı bulunamadı. İşlem yapılmadı.")
                return

            creator_id = creator[0]

            # Yalnızca bu kullanıcının oluşturduğu belirli testi bul.
            cur.execute(
                """
                SELECT id
                FROM quizzes
                WHERE title = %s
                  AND "createdById" = %s
                """,
                (TEST_QUIZ_TITLE, creator_id),
            )
            quizzes = cur.fetchall()

            if not quizzes:
                print("Temizlenecek test bulunamadı.")
                return

            if len(quizzes) > 1:
                print("Birden fazla eşleşme bulundu. Güvenlik için işlem durduruldu.")
                return

            quiz_id = quizzes[0][0]

            # Teste ait soru sayısını bul.
            cur.execute(
                """
                SELECT id
                FROM questions
                WHERE "quizId" = %s
                """,
                (quiz_id,),
            )
            question_ids = [row[0] for row in cur.fetchall()]

            # Katılım varsa otomatik silme yapma.
            cur.execute(
                """
                SELECT COUNT(*)
                FROM quiz_attempts
                WHERE "quizId" = %s
                """,
                (quiz_id,),
            )
            attempt_count = cur.fetchone()[0]

            print("\n--- TEMİZLİK ÖNİZLEMESİ ---")
            print(f"Test: {TEST_QUIZ_TITLE}")
            print(f"Test ID: {quiz_id}")
            print(f"Soru sayısı: {len(question_ids)}")
            print(f"Katılım sayısı: {attempt_count}")

            if attempt_count > 0:
                print("\nTest katılımları mevcut. Güvenlik nedeniyle silme yapılmadı.")
                return

            if not confirm:
                print("\nÖnizleme tamamlandı. Henüz hiçbir kayıt silinmedi.")
                print("Silmek için --confirm parametresini kullan.")
                return

            if question_ids:
                cur.execute(
                    """
                    DELETE FROM options
                    WHERE "questionId" = ANY(%s)
                    """,
                    (question_ids,),
                )

            cur.execute(
                """
                DELETE FROM questions
                WHERE "quizId" = %s
                """,
                (quiz_id,),
            )

            cur.execute(
                """
                DELETE FROM quizzes
                WHERE id = %s
                """,
                (quiz_id,),
            )

            print("\nTest ve ilişkili soru/seçenek kayıtları silindi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="HSDCode+ test verisi temizleme aracı"
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Önizleme yerine silme işlemini gerçekleştir.",
    )
    args = parser.parse_args()

    cleanup_test_quiz(confirm=args.confirm)