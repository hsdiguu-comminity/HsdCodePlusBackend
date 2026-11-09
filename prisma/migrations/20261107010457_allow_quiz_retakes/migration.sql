-- DropIndex
DROP INDEX "quiz_attempts_userId_quizId_key";

-- CreateIndex
CREATE INDEX "quiz_attempts_userId_quizId_idx" ON "quiz_attempts"("userId", "quizId");
