-- VANTA: one-time email ownership verification for account email changes.
-- Additive only. Existing users and email addresses are not modified.
CREATE TABLE IF NOT EXISTS "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldEmail" TEXT,
    "newEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailChangeRequest_userId_createdAt_idx"
    ON "EmailChangeRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_newEmail_createdAt_idx"
    ON "EmailChangeRequest"("newEmail", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_expiresAt_usedAt_idx"
    ON "EmailChangeRequest"("expiresAt", "usedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'EmailChangeRequest_userId_fkey'
          AND conrelid = '"public"."EmailChangeRequest"'::regclass
    ) THEN
        ALTER TABLE "EmailChangeRequest"
            ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
