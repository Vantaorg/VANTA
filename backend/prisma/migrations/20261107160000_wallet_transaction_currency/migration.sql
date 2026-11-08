ALTER TABLE "WalletTransaction"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VANTA';

-- Historical withdrawal rows represent USD earnings, not VANTA Coins.
UPDATE "WalletTransaction"
SET "currency" = 'USD'
WHERE "type" = 'WITHDRAWAL';
