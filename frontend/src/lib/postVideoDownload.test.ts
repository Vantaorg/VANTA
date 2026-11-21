// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { postVideoSource } from './postVideoDownload';

describe('postVideoSource', () => {
  it('returns null for text and image posts', () => {
    expect(postVideoSource(undefined)).toBeNull();
    expect(postVideoSource({ id: '1', content: 'hi' })).toBeNull();
    expect(postVideoSource({ id: '2', mediaUrl: 'https://x.test/a.jpg' })).toBeNull();
  });
  it('finds a video in attachments or the single media field', () => {
    expect(postVideoSource({ attachments: [{ url: 'https://x.test/a.jpg', type: 'image' }, { url: 'https://x.test/b.mp4' }] })).toContain('b.mp4');
    expect(postVideoSource({ mediaUrl: 'https://x.test/c.webm' })).toContain('c.webm');
    expect(postVideoSource({ type: 'video', media: 'https://x.test/stream' })).toContain('stream');
  });
});
