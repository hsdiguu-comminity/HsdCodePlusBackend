CREATE UNIQUE INDEX "quiz_attempts_one_active_per_user_quiz"
ON "quiz_attempts" ("userId", "quizId")
WHERE "finishedAt" IS NULL;