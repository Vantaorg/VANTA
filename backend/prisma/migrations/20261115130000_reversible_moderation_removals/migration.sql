ALTER TABLE "Post" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "Video" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "Story" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "PostComment" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "VideoComment" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "LiveStream" ADD COLUMN "moderationRemovedAt" TIMESTAMP(3);
ALTER TABLE "UploadedFile"
  ADD COLUMN "moderationOriginalPath" TEXT,
  ADD COLUMN "moderationOriginalUrl" TEXT;

CREATE INDEX "Post_moderationRemovedAt_idx" ON "Post"("moderationRemovedAt");
CREATE INDEX "Video_moderationRemovedAt_idx" ON "Video"("moderationRemovedAt");
CREATE INDEX "Story_moderationRemovedAt_idx" ON "Story"("moderationRemovedAt");
CREATE INDEX "PostComment_moderationRemovedAt_idx" ON "PostComment"("moderationRemovedAt");
CREATE INDEX "VideoComment_moderationRemovedAt_idx" ON "VideoComment"("moderationRemovedAt");
CREATE INDEX "Message_moderationRemovedAt_idx" ON "Message"("moderationRemovedAt");
CREATE INDEX "LiveStream_moderationRemovedAt_idx" ON "LiveStream"("moderationRemovedAt");

CREATE TABLE "ModerationRemoval" (
  "id" TEXT NOT NULL,
  "queueId" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'REPORT',
  "sourceId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "moderatorId" TEXT NOT NULL,
  "reason" TEXT,
  "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mediaQuarantineStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "restoredAt" TIMESTAMP(3),
  "restoredBy" TEXT,
  "restorationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationRemoval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationRemoval_queueId_key" ON "ModerationRemoval"("queueId");
CREATE INDEX "ModerationRemoval_targetType_targetId_removedAt_idx" ON "ModerationRemoval"("targetType", "targetId", "removedAt");
CREATE INDEX "ModerationRemoval_restoredAt_idx" ON "ModerationRemoval"("restoredAt");
CREATE INDEX "ModerationRemoval_moderatorId_removedAt_idx" ON "ModerationRemoval"("moderatorId", "removedAt");

ALTER TABLE "ModerationRemoval"
  ADD CONSTRAINT "ModerationRemoval_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "ModerationQueue"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
