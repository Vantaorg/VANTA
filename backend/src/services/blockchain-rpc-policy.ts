/**
 * RPC failure classification and retry policy for the blockchain payment watcher.
 *
 * Keep generic provider quota messages out of the range-splitting path: splitting
 * a rate-limited request can multiply traffic and make provider throttling worse.
 */
export function isBlockRangeLimitError(message: string): boolean {
  return /block range|range\s+(?:is\s+)?(?:too\s+(?:large|wide)|exceeds?\s+(?:the\s+)?maximum)|query returned more than|too many results|response size|result set too large|exceeds?\s+(?:the\s+)?(?:block|query)\s+(?:range|result|size)\s+(?:limit|cap)/i.test(message);
}

/** Exponential retry delay with a hard cap; the first failure uses baseMs. */
export function getNetworkRetryDelayMs(failureCount: number, baseMs: number, maxMs: number): number {
  const safeBase = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 1_000;
  const safeMax = Number.isFinite(maxMs) && maxMs >= safeBase ? maxMs : safeBase;
  const exponent = Math.max(0, Math.min(30, Math.trunc(failureCount) - 1));
  return Math.min(safeMax, safeBase * (2 ** exponent));
}
