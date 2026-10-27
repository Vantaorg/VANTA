/**
 * Strict validation for withdrawal request values.
 *
 * VANTA currently records withdrawal requests for manual settlement; this
 * validation does not authorize or trigger an external payout.
 */
export function validateWithdrawalInput(
  amount: unknown,
  walletAddress: unknown
): { amount: number; walletAddress: string } {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Withdrawal amount must be a finite positive number");
  }

  // Withdrawal accounting is denominated in cents. Reject excess precision
  // rather than silently charging or reserving a different amount.
  if (!Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) !== amount * 100) {
    throw new Error("Withdrawal amount can have at most two decimal places");
  }

  if (typeof walletAddress !== "string") {
    throw new Error("A valid USDT (BEP-20) wallet address is required");
  }
  const normalizedAddress = walletAddress.trim();
  // BNB Smart Chain uses EVM addresses: 0x followed by exactly 40 hex digits.
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
    throw new Error("A valid USDT (BEP-20) wallet address is required");
  }

  return { amount: Math.round(amount * 100) / 100, walletAddress: normalizedAddress };
}
