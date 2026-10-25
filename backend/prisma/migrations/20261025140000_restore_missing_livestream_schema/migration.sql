-- Restore the livestream schema when an earlier production rollout skipped these objects.
-- Strictly additive and idempotent: no existing rows are updated or deleted.
-- This migration assumes the core User table exists, as required by the Prisma schema.

CREATE TABLE IF NOT EXISTS "StreamCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "StreamCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiveStream" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "streamKey" TEXT,
  "playbackUrl" TEXT,
  "liveKitRoom" TEXT,
  "liveKitToken" TEXT,
  "viewerCount" INTEGER NOT NULL DEFAULT 0,
  "peakViewers" INTEGER NOT NULL DEFAULT 0,
  "totalViewers" INTEGER NOT NULL DEFAULT 0,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "gifts" INTEGER NOT NULL DEFAULT 0,
  "allowGifts" BOOLEAN NOT NULL DEFAULT true,
  "allowPK" BOOLEAN NOT NULL DEFAULT false,
  "allowGuests" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'LIVE',
  "categoryName" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "country" TEXT,
  "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "recordingUrl" TEXT,
  "duration" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "lastHostHeartbeat" TIMESTAMP(3),
  "chatPaused" BOOLEAN NOT NULL DEFAULT false,
  "slowMode" BOOLEAN NOT NULL DEFAULT false,
  "slowModeInterval" INTEGER NOT NULL DEFAULT 3,
  "mutedUsers" TEXT,
  "bannedUsers" TEXT,
  "moderators" TEXT,
  "coHostId" TEXT,
  "guests" TEXT,
  "approvedGuests" TEXT,
  "screenShare" BOOLEAN NOT NULL DEFAULT false,
  "beautyMode" BOOLEAN NOT NULL DEFAULT false,
  "backgroundBlur" BOOLEAN NOT NULL DEFAULT false,
  "noiseSuppression" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiveReaction" (
  "id" TEXT NOT NULL, "streamId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveReaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "LiveChatMessage" (
  "id" TEXT NOT NULL, "streamId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "StreamViewer" (
  "id" TEXT NOT NULL, "streamId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamViewer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "StreamFollower" (
  "id" TEXT NOT NULL, "streamerId" TEXT NOT NULL, "followerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamFollower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveStream_liveKitRoom_key" ON "LiveStream"("liveKitRoom");
CREATE INDEX IF NOT EXISTS "LiveStream_active_viewerCount_idx" ON "LiveStream"("active", "viewerCount");
CREATE INDEX IF NOT EXISTS "LiveStream_hostId_active_idx" ON "LiveStream"("hostId", "active");
CREATE INDEX IF NOT EXISTS "LiveStream_categoryName_active_idx" ON "LiveStream"("categoryName", "active");
CREATE INDEX IF NOT EXISTS "LiveStream_active_createdAt_idx" ON "LiveStream"("active", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveStream_active_categoryName_viewerCount_idx" ON "LiveStream"("active", "categoryName", "viewerCount");
CREATE INDEX IF NOT EXISTS "LiveStream_active_status_lastHostHeartbeat_idx" ON "LiveStream"("active", "status", "lastHostHeartbeat");
CREATE INDEX IF NOT EXISTS "LiveStream_hostId_active_createdAt_idx" ON "LiveStream"("hostId", "active", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveStream_title_idx" ON "LiveStream"("title");
CREATE INDEX IF NOT EXISTS "LiveStream_status_idx" ON "LiveStream"("status");
CREATE INDEX IF NOT EXISTS "LiveStream_language_idx" ON "LiveStream"("language");
CREATE INDEX IF NOT EXISTS "LiveStream_country_idx" ON "LiveStream"("country");
CREATE INDEX IF NOT EXISTS "LiveReaction_streamId_createdAt_idx" ON "LiveReaction"("streamId", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveReaction_userId_streamId_idx" ON "LiveReaction"("userId", "streamId");
CREATE UNIQUE INDEX IF NOT EXISTS "StreamCategory_name_key" ON "StreamCategory"("name");
CREATE INDEX IF NOT EXISTS "StreamCategory_name_idx" ON "StreamCategory"("name");
CREATE INDEX IF NOT EXISTS "LiveChatMessage_streamId_createdAt_idx" ON "LiveChatMessage"("streamId", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveChatMessage_userId_streamId_createdAt_idx" ON "LiveChatMessage"("userId", "streamId", "createdAt");
CREATE INDEX IF NOT EXISTS "StreamViewer_streamId_idx" ON "StreamViewer"("streamId");
CREATE INDEX IF NOT EXISTS "StreamViewer_userId_streamId_idx" ON "StreamViewer"("userId", "streamId");
CREATE UNIQUE INDEX IF NOT EXISTS "StreamViewer_streamId_userId_key" ON "StreamViewer"("streamId", "userId");
CREATE INDEX IF NOT EXISTS "StreamFollower_followerId_idx" ON "StreamFollower"("followerId");
CREATE INDEX IF NOT EXISTS "StreamFollower_streamerId_followerId_createdAt_idx" ON "StreamFollower"("streamerId", "followerId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StreamFollower_streamerId_followerId_key" ON "StreamFollower"("streamerId", "followerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveStream_hostId_fkey') THEN
    ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveStream_categoryName_fkey') THEN
    ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_categoryName_fkey" FOREIGN KEY ("categoryName") REFERENCES "StreamCategory"("name") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveStream_coHostId_fkey') THEN
    ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_coHostId_fkey" FOREIGN KEY ("coHostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveReaction_streamId_fkey') THEN
    ALTER TABLE "LiveReaction" ADD CONSTRAINT "LiveReaction_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveReaction_userId_fkey') THEN
    ALTER TABLE "LiveReaction" ADD CONSTRAINT "LiveReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveChatMessage_streamId_fkey') THEN
    ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiveChatMessage_userId_fkey') THEN
    ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StreamViewer_streamId_fkey') THEN
    ALTER TABLE "StreamViewer" ADD CONSTRAINT "StreamViewer_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StreamViewer_userId_fkey') THEN
    ALTER TABLE "StreamViewer" ADD CONSTRAINT "StreamViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StreamFollower_streamerId_fkey') THEN
    ALTER TABLE "StreamFollower" ADD CONSTRAINT "StreamFollower_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StreamFollower_followerId_fkey') THEN
    ALTER TABLE "StreamFollower" ADD CONSTRAINT "StreamFollower_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
