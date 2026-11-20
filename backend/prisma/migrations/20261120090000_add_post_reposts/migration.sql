-- Persistent repost and quote-repost records.
-- Unique (userId, postId) ensures one repost per user/post; quoteText is optional.
CREATE TABLE "PostRepost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "quoteText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostRepost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PostRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostRepost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostRepost_userId_postId_key" ON "PostRepost"("userId", "postId");
CREATE INDEX "PostRepost_userId_createdAt_idx" ON "PostRepost"("userId", "createdAt");
CREATE INDEX "PostRepost_postId_createdAt_idx" ON "PostRepost"("postId", "createdAt");
