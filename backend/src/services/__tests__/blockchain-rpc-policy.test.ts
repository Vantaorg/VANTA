import { getNetworkRetryDelayMs, isBlockRangeLimitError } from '../blockchain-rpc-policy';

describe('blockchain RPC retry policy', () => {
  describe('isBlockRangeLimitError', () => {
    it.each([
      'block range is too wide',
      'eth_getLogs query returned more than 10000 results',
      'too many results for this request',
      'response size exceeds provider limit',
    ])('recognizes range/result cap: %s', (message) => {
      expect(isBlockRangeLimitError(message)).toBe(true);
    });

    it.each([
      'limit exceeded',
      'rate limit exceeded',
      'daily request quota exceeded',
      'HTTP 429 Too Many Requests',
      'request timeout',
    ])('does not split generic quota or transport errors: %s', (message) => {
      expect(isBlockRangeLimitError(message)).toBe(false);
    });
  });

  describe('getNetworkRetryDelayMs', () => {
    it('starts with the normal poll interval', () => {
      expect(getNetworkRetryDelayMs(1, 30_000, 300_000)).toBe(30_000);
    });

    it('backs off exponentially', () => {
      expect(getNetworkRetryDelayMs(2, 30_000, 300_000)).toBe(60_000);
      expect(getNetworkRetryDelayMs(3, 30_000, 300_000)).toBe(120_000);
    });

    it('caps the delay', () => {
      expect(getNetworkRetryDelayMs(20, 30_000, 300_000)).toBe(300_000);
    });

    it('uses safe defaults for invalid base delays', () => {
      expect(getNetworkRetryDelayMs(1, 0, 300_000)).toBe(1_000);
    });
  });
});
