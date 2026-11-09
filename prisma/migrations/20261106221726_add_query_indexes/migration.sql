-- DropIndex
DROP INDEX "score_events_createdAt_idx";

-- CreateIndex
CREATE INDEX "bans_userId_idx" ON "bans"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "post_images_postId_idx" ON "post_images"("postId");

-- CreateIndex
CREATE INDEX "posts_status_publishedAt_idx" ON "posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "quiz_attempts_quizId_score_idx" ON "quiz_attempts"("quizId", "score");

-- CreateIndex
CREATE INDEX "quizzes_isPublished_startsAt_endsAt_idx" ON "quizzes"("isPublished", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "quizzes_categoryId_isPublished_idx" ON "quizzes"("categoryId", "isPublished");

-- CreateIndex
CREATE INDEX "score_events_createdAt_userId_idx" ON "score_events"("createdAt", "userId");

-- CreateIndex
CREATE INDEX "users_communityId_status_idx" ON "users"("communityId", "status");
