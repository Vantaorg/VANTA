/**
 * VANTA watermarked video export (client side).
 *
 * Only the DOWNLOADED copy is branded. The original upload and normal playback
 * are never touched: we fetch the video into a Blob, play it into an off-screen
 * <video>, paint each frame plus the VANTA mark to a canvas, and record the
 * canvas video + the source audio with MediaRecorder. The result is a new file.
 *
 * Support (honest): needs MediaRecorder, canvas.captureStream and AudioContext
 * (current Chrome/Edge/Android WebView, Firefox, Safari 14.1+). Export runs in
 * real time (a 30s reel takes ~30s) and the container is whatever MediaRecorder
 * offers: MP4 where supported, otherwise WebM. Unsupported browsers get
 * `supportsWatermarkExport() === false` and NO unbranded copy is offered.
 */

export const WATERMARK_HOP_SECONDS = 3;
export const WATERMARK_FADE_SECONDS = 0.5;
export const WATERMARK_BRAND = 'VANTA';

export function sanitizeHandle(raw?: string | null): string {
  const cleaned = String(raw ?? '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30);
  return cleaned ? `@${cleaned}` : '';
}

export function watermarkFileName(handle: string, reelId: string, mime: string): string {
  const ext = /mp4/i.test(mime) ? 'mp4' : 'webm';
  const who = sanitizeHandle(handle).replace('@', '') || 'creator';
  const id = String(reelId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'reel';
  return `vanta-${who}-${id}.${ext}`;
}

export interface WatermarkState {
  /** 0 = top-left, 1 = bottom-right (hops like TikTok's moving mark). */
  corner: 0 | 1;
  alpha: number;
}

/** Pure animation: hop corners every WATERMARK_HOP_SECONDS, fading through zero. */
export function watermarkState(t: number): WatermarkState {
  const time = Number.isFinite(t) && t > 0 ? t : 0;
  const slot = Math.floor(time / WATERMARK_HOP_SECONDS);
  const local = time - slot * WATERMARK_HOP_SECONDS;
  const fadeIn = Math.min(1, local / WATERMARK_FADE_SECONDS);
  const fadeOut = Math.min(1, (WATERMARK_HOP_SECONDS - local) / WATERMARK_FADE_SECONDS);
  return { corner: (slot % 2) as 0 | 1, alpha: 0.85 * Math.max(0, Math.min(fadeIn, fadeOut)) };
}

export function watermarkScale(width: number, height: number): number {
  return Math.max(0.5, Math.min(width, height) / 720);
}

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, handle: string): void {
  const { corner, alpha } = watermarkState(t);
  if (alpha <= 0.01) return;
  const s = watermarkScale(width, height);
  const margin = 24 * s;
  const brandSize = 30 * s;
  const handleSize = 20 * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6 * s;
  ctx.font = `800 ${brandSize}px ${FONT}`;
  const brandWidth = ctx.measureText(WATERMARK_BRAND).width;
  ctx.font = `600 ${handleSize}px ${FONT}`;
  const handleWidth = handle ? ctx.measureText(handle).width : 0;
  const blockW = Math.max(brandWidth, handleWidth);
  const blockH = brandSize + (handle ? handleSize + 4 * s : 0);
  const x = corner === 0 ? margin : width - margin - blockW;
  const y = corner === 0 ? margin : height - margin - blockH;
  ctx.fillStyle = '#e0bb4f';
  ctx.font = `800 ${brandSize}px ${FONT}`;
  ctx.fillText(WATERMARK_BRAND, x, y);
  if (handle) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${handleSize}px ${FONT}`;
    ctx.fillText(handle, x, y + brandSize + 4 * s);
  }
  ctx.restore();
}

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecorderMime(isSupported: (m: string) => boolean): string | null {
  for (const mime of MIME_CANDIDATES) {
    try { if (isSupported(mime)) return mime; } catch { /* try next */ }
  }
  return null;
}

export function supportsWatermarkExport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const w = window as any;
  if (typeof w.MediaRecorder !== 'function' || !(w.AudioContext || w.webkitAudioContext)) return false;
  if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false;
  return pickRecorderMime((m) => Boolean(w.MediaRecorder.isTypeSupported?.(m))) !== null;
}

export interface WatermarkExportResult { blob: Blob; mime: string }

export async function exportWatermarkedVideo(opts: {
  url: string;
  handle: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<WatermarkExportResult> {
  if (!supportsWatermarkExport()) throw new Error('unsupported');
  const w = window as any;
  const handle = sanitizeHandle(opts.handle);
  const res = await fetch(opts.url, { signal: opts.signal });
  if (!res.ok) throw new Error('Could not load the video');
  const source = await res.blob();
  const objectUrl = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.src = objectUrl;
  const audioCtx: AudioContext = new (w.AudioContext || w.webkitAudioContext)();
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read the video'));
    });
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error('Could not read the video size');
    const canvas = document.createElement('canvas');
    canvas.width = width; // same pixel size = same aspect ratio as the source
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('unsupported');

    const stream = canvas.captureStream(30);
    const audioDest = audioCtx.createMediaStreamDestination();
    // Routed only to the recorder (not the speakers), so the export is silent to the user.
    audioCtx.createMediaElementSource(video).connect(audioDest);
    audioDest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mime = pickRecorderMime((m) => Boolean(w.MediaRecorder.isTypeSupported?.(m))) as string;
    const recorder: MediaRecorder = new w.MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent) => { if (e.data?.size) chunks.push(e.data); };
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
      recorder.onerror = () => reject(new Error('Recording failed'));
    });

    let raf = 0;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const paint = () => {
      ctx.drawImage(video, 0, 0, width, height);
      drawWatermark(ctx, width, height, video.currentTime, handle);
      if (duration > 0) opts.onProgress?.(Math.min(1, video.currentTime / duration));
      raf = requestAnimationFrame(paint);
    };
    const finish = () => { cancelAnimationFrame(raf); if (recorder.state !== 'inactive') recorder.stop(); };
    opts.signal?.addEventListener('abort', () => { video.pause(); finish(); });
    video.onended = finish;

    await audioCtx.resume();
    recorder.start(250);
    await video.play();
    paint();
    const blob = await done;
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!blob.size) throw new Error('Export produced an empty file');
    opts.onProgress?.(1);
    return { blob, mime: blob.type || mime.split(';')[0] };
  } finally {
    video.pause();
    URL.revokeObjectURL(objectUrl);
    void audioCtx.close().catch(() => undefined);
  }
}

/** Save a Blob: Android app via the native bridge (WebView ignores blob downloads), else <a download>. */
export async function saveBlobToDevice(blob: Blob, fileName: string): Promise<'native' | 'browser'> {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const nativeVideo = w?.VantaNativeVideo;
  const nonce = w?.__VANTA_NATIVE_SHARE_NONCE;
  if (nativeVideo?.saveVideoChunk && nonce) {
    const CHUNK = 192 * 1024; // multiple of 3 so base64 chunks concatenate cleanly
    const id = `v${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const total = Math.max(1, Math.ceil(blob.size / CHUNK));
    for (let i = 0; i < total; i++) {
      const buf = new Uint8Array(await blob.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer());
      let bin = '';
      for (let j = 0; j < buf.length; j += 0x8000) bin += String.fromCharCode(...buf.subarray(j, j + 0x8000));
      const ok = nativeVideo.saveVideoChunk(nonce, id, btoa(bin), i, total, fileName, blob.type || 'video/mp4');
      if (!ok) throw new Error('Could not save to this device');
    }
    return 'native';
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
  return 'browser';
}
