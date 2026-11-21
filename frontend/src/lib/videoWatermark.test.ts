// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  WATERMARK_HOP_SECONDS,
  pickRecorderMime,
  sanitizeHandle,
  supportsWatermarkExport,
  watermarkFileName,
  watermarkScale,
  watermarkState,
} from './videoWatermark';

describe('videoWatermark', () => {
  it('sanitizes creator handles', () => {
    expect(sanitizeHandle('alex')).toBe('@alex');
    expect(sanitizeHandle('@@al ex<b>')).toBe('@alexb');
    expect(sanitizeHandle('')).toBe('');
    expect(sanitizeHandle(null)).toBe('');
  });
  it('names files safely with the right extension', () => {
    expect(watermarkFileName('@alex', 'r/1', 'video/mp4')).toBe('vanta-alex-r1.mp4');
    expect(watermarkFileName('', '', 'video/webm')).toBe('vanta-creator-reel.webm');
  });
  it('animates: hops corners, fades at the edges, never fully opaque', () => {
    expect(watermarkState(0).alpha).toBe(0);
    expect(watermarkState(WATERMARK_HOP_SECONDS / 2).alpha).toBeCloseTo(0.85);
    expect(watermarkState(1).corner).toBe(0);
    expect(watermarkState(WATERMARK_HOP_SECONDS + 1).corner).toBe(1);
    expect(watermarkState(WATERMARK_HOP_SECONDS * 2 + 1).corner).toBe(0);
    expect(watermarkState(-5).alpha).toBe(0);
    expect(watermarkState(NaN).alpha).toBe(0);
  });
  it('scales with the short side and keeps a floor', () => {
    expect(watermarkScale(1080, 1920)).toBe(1.5);
    expect(watermarkScale(100, 100)).toBe(0.5);
  });
  it('picks the first supported recorder mime, or null', () => {
    expect(pickRecorderMime((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickRecorderMime((m) => m.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
  it('reports unsupported when there is no browser', () => {
    expect(supportsWatermarkExport()).toBe(false);
  });
});
