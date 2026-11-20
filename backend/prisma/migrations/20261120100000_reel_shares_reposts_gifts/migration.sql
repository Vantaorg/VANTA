-- Persist Reel share/repost events and associate completed gifts with Reels.
CREATE TABLE IF NOT EXISTS "ReelShare" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReelShare_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ReelRepost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReelRepost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReelRepost_userId_videoId_key" ON "ReelRepost"("userId", "videoId");
CREATE INDEX IF NOT EXISTS "ReelShare_videoId_createdAt_idx" ON "ReelShare"("videoId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReelShare_userId_createdAt_idx" ON "ReelShare"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReelRepost_videoId_createdAt_idx" ON "ReelRepost"("videoId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReelRepost_userId_createdAt_idx" ON "ReelRepost"("userId", "createdAt");
ALTER TABLE "GiftTransaction" ADD COLUMN IF NOT EXISTS "videoId" TEXT;
CREATE INDEX IF NOT EXISTS "GiftTransaction_videoId_status_createdAt_idx" ON "GiftTransaction"("videoId", "status", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelShare_userId_fkey') THEN
    ALTER TABLE "ReelShare" ADD CONSTRAINT "ReelShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelShare_videoId_fkey') THEN
    ALTER TABLE "ReelShare" ADD CONSTRAINT "ReelShare_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelRepost_userId_fkey') THEN
    ALTER TABLE "ReelRepost" ADD CONSTRAINT "ReelRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelRepost_videoId_fkey') THEN
    ALTER TABLE "ReelRepost" ADD CONSTRAINT "ReelRepost_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiftTransaction_videoId_fkey') THEN
    ALTER TABLE "GiftTransaction" ADD CONSTRAINT "GiftTransaction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
