-- Add persistent likes for Reel comments and their per-viewer state.
CREATE TABLE IF NOT EXISTS "VideoCommentLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoCommentLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VideoCommentLike_userId_commentId_key"
    ON "VideoCommentLike"("userId", "commentId");
CREATE INDEX IF NOT EXISTS "VideoCommentLike_commentId_createdAt_idx"
    ON "VideoCommentLike"("commentId", "createdAt");
CREATE INDEX IF NOT EXISTS "VideoCommentLike_userId_createdAt_idx"
    ON "VideoCommentLike"("userId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoCommentLike_userId_fkey') THEN
        ALTER TABLE "VideoCommentLike"
            ADD CONSTRAINT "VideoCommentLike_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoCommentLike_commentId_fkey') THEN
        ALTER TABLE "VideoCommentLike"
            ADD CONSTRAINT "VideoCommentLike_commentId_fkey"
            FOREIGN KEY ("commentId") REFERENCES "VideoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
