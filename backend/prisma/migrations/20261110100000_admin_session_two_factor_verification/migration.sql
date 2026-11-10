-- Bind successful administrator 2FA verification to the authenticated session.
-- Existing sessions intentionally remain NULL and must re-authenticate with 2FA.
ALTER TABLE "Session"
ADD COLUMN "adminTwoFactorVerifiedAt" TIMESTAMP(3);
