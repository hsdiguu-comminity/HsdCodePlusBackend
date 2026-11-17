"""JSON dosyasından toplu quiz/soru aktarımı (admin kolaylığı).

Kullanım:  python scripts/import_questions.py [dosya.json] [--admin admin@ornek.com]
Varsayılan dosya: scripts/data/questions.json
--admin verilirse quizlerin sahibi bu admin olur (JSON'daki created_by_email yok sayılır).
Quizler TASLAK olarak eklenir; admin panelinden kontrol edilip yayınlanır.
Tüm dosya tek transaction'da aktarılır: bir hata olursa hiçbir şey eklenmez.
"""

import argparse
import json
from pathlib import Path

from db import get_connection, new_id

DEFAULT_FILE = Path(__file__).resolve().parent / "data" / "questions.json"
DEFAULT_TIME_LIMIT_SEC = 300


def validate_quiz(quiz, index):
    prefix = f"Test #{index}"
    if not isinstance(quiz, dict):
        raise ValueError(f"{prefix}: Nesne bekleniyor.")

    for field in ("category_slug", "title", "created_by_email"):
        if not isinstance(quiz.get(field), str) or not quiz[field].strip():
            raise ValueError(f"{prefix}: '{field}' zorunludur.")

    if quiz.get("description") is not None and not isinstance(quiz["description"], str):
        raise ValueError(f"{prefix}: description metin olmalıdır.")

    time_limit = quiz.get("time_limit_sec", DEFAULT_TIME_LIMIT_SEC)
    if type(time_limit) is not int or not 30 <= time_limit <= 3 * 60 * 60:
        raise ValueError(f"{prefix}: time_limit_sec 30 ile 10800 arasında tam sayı olmalıdır.")

    questions = quiz.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError(f"{prefix}: En az bir soru ekleyin.")

    for q_index, question in enumerate(questions, start=1):
        q_prefix = f"{prefix}, soru #{q_index}"
        if not isinstance(question, dict):
            raise ValueError(f"{q_prefix}: Nesne bekleniyor.")
        if not isinstance(question.get("text"), str) or not question["text"].strip():
            raise ValueError(f"{q_prefix}: Soru metni zorunludur.")
        if question.get("explanation") is not None and not isinstance(question["explanation"], str):
            raise ValueError(f"{q_prefix}: explanation metin olmalıdır.")

        points = question.get("points")
        if type(points) is not int or points <= 0:
            raise ValueError(f"{q_prefix}: points pozitif tam sayı olmalıdır.")

        options = question.get("options")
        if not isinstance(options, list) or not 2 <= len(options) <= 6:
            raise ValueError(f"{q_prefix}: 2 ile 6 arasında seçenek olmalıdır.")
        for option in options:
            if not isinstance(option, dict):
                raise ValueError(f"{q_prefix}: Seçenek nesne olmalıdır.")
            if not isinstance(option.get("text"), str) or not option["text"].strip():
                raise ValueError(f"{q_prefix}: Seçenek metni boş olamaz.")
            if type(option.get("is_correct")) is not bool:
                raise ValueError(f"{q_prefix}: is_correct true veya false olmalıdır.")

        if sum(option["is_correct"] for option in options) != 1:
            raise ValueError(f"{q_prefix}: Tam olarak bir doğru seçenek olmalıdır.")


def import_questions(data_file: Path, admin_email: str | None = None):
    if not data_file.is_file():
        raise FileNotFoundError(f"JSON dosyası bulunamadı: {data_file}")

    with data_file.open(encoding="utf-8") as file:
        quizzes = json.load(file)
    if not isinstance(quizzes, list) or not quizzes:
        raise ValueError("JSON, en az bir test içeren liste olmalıdır.")

    if admin_email:
        for quiz in quizzes:
            if isinstance(quiz, dict):
                quiz["created_by_email"] = admin_email

    for index, quiz in enumerate(quizzes, start=1):
        validate_quiz(quiz, index)

    with get_connection() as conn, conn.cursor() as cur:
        for quiz in quizzes:
            cur.execute("SELECT id FROM categories WHERE slug = %s", (quiz["category_slug"],))
            category = cur.fetchone()
            if category is None:
                raise ValueError(f"Kategori bulunamadı: {quiz['category_slug']}")

            cur.execute(
                "SELECT id FROM users WHERE email = %s AND role = 'ADMIN'",
                (quiz["created_by_email"].strip().lower(),),
            )
            creator = cur.fetchone()
            if creator is None:
                raise ValueError(f"Bu e-postaya sahip bir admin bulunamadı: {quiz['created_by_email']}")

            cur.execute(
                "SELECT 1 FROM quizzes WHERE title = %s AND category_id = %s",
                (quiz["title"], category[0]),
            )
            if cur.fetchone() is not None:
                raise ValueError(f"Bu kategoride aynı başlıklı test zaten var: {quiz['title']}")

            quiz_id = new_id()
            cur.execute(
                """
                INSERT INTO quizzes (id, category_id, title, description, time_limit_sec, created_by, is_published)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
                """,
                (
                    quiz_id,
                    category[0],
                    quiz["title"],
                    quiz.get("description"),
                    quiz.get("time_limit_sec", DEFAULT_TIME_LIMIT_SEC),
                    creator[0],
                ),
            )

            for order, question in enumerate(quiz["questions"]):
                question_id = new_id()
                cur.execute(
                    'INSERT INTO questions (id, quiz_id, text, explanation, points, "order") VALUES (%s, %s, %s, %s, %s, %s)',
                    (question_id, quiz_id, question["text"], question.get("explanation"), question["points"], order),
                )
                for option in question["options"]:
                    cur.execute(
                        "INSERT INTO options (id, question_id, text, is_correct) VALUES (%s, %s, %s, %s)",
                        (new_id(), question_id, option["text"], option["is_correct"]),
                    )

            print(f"Taslak quiz eklendi: {quiz['title']} ({len(quiz['questions'])} soru)")

    print(f"İçe aktarma tamamlandı: {len(quizzes)} test. Admin panelinden yayınlamayı unutmayın.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="JSON dosyasından quiz aktarımı")
    parser.add_argument("file", nargs="?", type=Path, default=DEFAULT_FILE)
    parser.add_argument("--admin", help="Quizlerin sahibi olacak adminin e-postası")
    args = parser.parse_args()
    import_questions(args.file, args.admin.strip().lower() if args.admin else None)
