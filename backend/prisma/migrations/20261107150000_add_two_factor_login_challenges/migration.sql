CREATE TABLE "TwoFactorLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactorLoginChallenge_tokenHash_key" ON "TwoFactorLoginChallenge"("tokenHash");
CREATE INDEX "TwoFactorLoginChallenge_userId_expiresAt_idx" ON "TwoFactorLoginChallenge"("userId", "expiresAt");
CREATE INDEX "TwoFactorLoginChallenge_expiresAt_idx" ON "TwoFactorLoginChallenge"("expiresAt");

ALTER TABLE "TwoFactorLoginChallenge"
ADD CONSTRAINT "TwoFactorLoginChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
