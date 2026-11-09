import json
from pathlib import Path

from db import get_connection

DATA_FILE = Path(__file__).resolve().parent / "data" / "questions.json"


def validate_quiz(quiz, index):
    prefix = f"Test #{index}"

    if not isinstance(quiz, dict):
        raise ValueError(f"{prefix}: Nesne bekleniyor.")

    for field in ("category_slug", "title", "created_by_email"):
        if not isinstance(quiz.get(field), str) or not quiz[field].strip():
            raise ValueError(f"{prefix}: '{field}' zorunludur.")

    if quiz.get("description") is not None and not isinstance(
        quiz["description"], str
    ):
        raise ValueError(f"{prefix}: description metin olmalıdır.")

    time_limit = quiz.get("time_limit_sec")
    if time_limit is not None and (
        type(time_limit) is not int or time_limit <= 0
    ):
        raise ValueError(
            f"{prefix}: time_limit_sec pozitif tam sayı olmalıdır."
        )

    questions = quiz.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError(f"{prefix}: En az bir soru ekleyin.")

    for q_index, question in enumerate(questions, start=1):
        q_prefix = f"{prefix}, soru #{q_index}"

        if not isinstance(question, dict):
            raise ValueError(f"{q_prefix}: Nesne bekleniyor.")

        if not isinstance(question.get("text"), str) or not question["text"].strip():
            raise ValueError(f"{q_prefix}: Soru metni zorunludur.")

        points = question.get("points")
        if type(points) is not int or points <= 0:
            raise ValueError(f"{q_prefix}: points pozitif tam sayı olmalıdır.")

        options = question.get("options")
        if not isinstance(options, list) or len(options) < 2:
            raise ValueError(f"{q_prefix}: En az iki seçenek gereklidir.")

        for option in options:
            if not isinstance(option, dict):
                raise ValueError(f"{q_prefix}: Seçenek nesne olmalıdır.")
            if not isinstance(option.get("text"), str) or not option["text"].strip():
                raise ValueError(f"{q_prefix}: Seçenek metni boş olamaz.")
            if type(option.get("is_correct")) is not bool:
                raise ValueError(
                    f"{q_prefix}: is_correct true veya false olmalıdır."
                )

        if sum(option["is_correct"] for option in options) != 1:
            raise ValueError(
                f"{q_prefix}: Tam olarak bir doğru seçenek olmalıdır."
            )


def import_questions():
    if not DATA_FILE.is_file():
        raise FileNotFoundError(
            f"JSON dosyası bulunamadı: {DATA_FILE}"
        )

    with DATA_FILE.open("r", encoding="utf-8") as file:
        quizzes = json.load(file)

    if not isinstance(quizzes, list) or not quizzes:
        raise ValueError("JSON, en az bir test içeren liste olmalıdır.")

    for index, quiz in enumerate(quizzes, start=1):
        validate_quiz(quiz, index)

    with get_connection() as conn:
        with conn.cursor() as cur:
            for quiz in quizzes:
                cur.execute(
                    'SELECT id FROM categories WHERE slug = %s',
                    (quiz["category_slug"],),
                )
                category = cur.fetchone()

                if category is None:
                    raise ValueError(
                        f"Kategori bulunamadı: {quiz['category_slug']}"
                    )

                cur.execute(
                    'SELECT id FROM users WHERE email = %s',
                    (quiz["created_by_email"],),
                )
                creator = cur.fetchone()

                if creator is None:
                    raise ValueError(
                        "Testi oluşturan kullanıcı bulunamadı: "
                        f"{quiz['created_by_email']}"
                    )

                cur.execute(
                    'SELECT id FROM quizzes '
                    'WHERE title = %s AND "categoryId" = %s',
                    (quiz["title"], category[0]),
                )
                if cur.fetchone() is not None:
                    raise ValueError(
                        f"Bu kategoride aynı başlıklı test zaten var: "
                        f"{quiz['title']}"
                    )

                cur.execute(
                    """
                    INSERT INTO quizzes
                        ("categoryId", title, description,
                         "timeLimitSec", "createdById", "isPublished")
                    VALUES (%s, %s, %s, %s, %s, FALSE)
                    RETURNING id
                    """,
                    (
                        category[0],
                        quiz["title"],
                        quiz.get("description"),
                        quiz.get("time_limit_sec"),
                        creator[0],
                    ),
                )
                quiz_id = cur.fetchone()[0]

                for order, question in enumerate(
                    quiz["questions"], start=1
                ):
                    cur.execute(
                        """
                        INSERT INTO questions
                            ("quizId", text, points, "order")
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            quiz_id,
                            question["text"],
                            question["points"],
                            order,
                        ),
                    )
                    question_id = cur.fetchone()[0]

                    for option in question["options"]:
                        cur.execute(
                            """
                            INSERT INTO options
                                ("questionId", text, "isCorrect")
                            VALUES (%s, %s, %s)
                            """,
                            (
                                question_id,
                                option["text"],
                                option["is_correct"],
                            ),
                        )

                print(f"Test hazırlandı: {quiz['title']} (ID: {quiz_id})")

    print(f"İçe aktarma tamamlandı: {len(quizzes)} test.")


if __name__ == "__main__":
    import_questions()