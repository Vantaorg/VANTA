-- Persist the audit hash chain and retain evidence when an account is deleted.
ALTER TABLE "SecurityLog"
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "hash" TEXT;

ALTER TABLE "SecurityLog"
  DROP CONSTRAINT IF EXISTS "SecurityLog_userId_fkey";

ALTER TABLE "SecurityLog"
  ADD CONSTRAINT "SecurityLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SecurityLog_createdAt_id_idx"
  ON "SecurityLog"("createdAt", "id");
