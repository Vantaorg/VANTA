CREATE TABLE IF NOT EXISTS "QueueJob" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lockedAt" TIMESTAMPTZ,
  "lockedUntil" TIMESTAMPTZ,
  "workerId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "QueueJob_claim_idx"
  ON "QueueJob" ("status", "runAt", "priority" DESC, "createdAt");
CREATE INDEX IF NOT EXISTS "QueueJob_lease_idx"
  ON "QueueJob" ("status", "lockedUntil");
