-- Store the unique on-chain transaction proving a USDT withdrawal was paid.
ALTER TABLE "Withdrawal" ADD COLUMN "transactionHash" TEXT;

CREATE UNIQUE INDEX "Withdrawal_transactionHash_key"
ON "Withdrawal"("transactionHash");
