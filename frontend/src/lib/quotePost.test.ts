import { describe, expect, it } from 'vitest';
import { extractQuoteRef } from './quotePost';

describe('extractQuoteRef', () => {
  it('finds a same-host post link and strips it from the text', () => {
    const r = extractQuoteRef('nice one\n\nhttps://vanta.app/post/abc123', 'vanta.app');
    expect(r?.ref).toMatchObject({ kind: 'post', id: 'abc123', path: '/post/abc123' });
    expect(r?.rest).toBe('nice one');
  });
  it('handles reels and link-only quotes', () => {
    const r = extractQuoteRef('https://vanta.app/reels/xyz', 'vanta.app');
    expect(r?.ref.kind).toBe('reel');
    expect(r?.rest).toBe('');
  });
  it('ignores other hosts and empty input', () => {
    expect(extractQuoteRef('see https://example.com/post/1', 'vanta.app')).toBeNull();
    expect(extractQuoteRef('hi', 'vanta.app')).toBeNull();
    expect(extractQuoteRef('https://vanta.app/post/1', undefined)).toBeNull();
  });
});
