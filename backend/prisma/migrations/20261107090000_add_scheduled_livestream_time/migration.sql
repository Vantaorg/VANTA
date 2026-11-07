-- Add a dedicated planned start time for scheduled livestreams.
-- Existing rows remain unchanged; this is an additive nullable column.
ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "LiveStream_hostId_status_scheduledAt_idx"
  ON "LiveStream"("hostId", "status", "scheduledAt");
