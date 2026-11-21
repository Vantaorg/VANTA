import { resolveMediaUrl } from '@/lib/mediaUrl';
import { exportWatermarkedVideo, saveBlobToDevice, supportsWatermarkExport, watermarkFileName } from '@/lib/videoWatermark';

type Item = Record<string, any>;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

// First video URL of a feed post (attachments first, then the single media field). Null when the post has no video.
export function postVideoSource(item: Item | undefined): string | null {
  if (!item) return null;
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  for (const a of attachments) {
    const url = String(a?.url || a?.src || '');
    if (url && (/video/i.test(String(a?.type || a?.mimeType || '')) || VIDEO_EXT.test(url))) return resolveMediaUrl(url);
  }
  const single = String(item.media || item.mediaUrl || item.playbackUrl || '');
  if (single && (item.type === 'video' || VIDEO_EXT.test(single))) return resolveMediaUrl(single);
  return null;
}

// True when a Save video action should be offered for this post in this browser/webview.
export function canDownloadPostVideo(item: Item | undefined): boolean {
  return postVideoSource(item) !== null && supportsWatermarkExport();
}

type Toast = { success: (title: string, body?: string) => void; error: (title: string, body?: string) => void };

// Exports a VANTA-watermarked copy of the post video and saves it. The stored upload and on-screen player are untouched.
export async function downloadPostVideo(item: Item, toast: Toast, onProgress?: (fraction: number | null) => void): Promise<void> {
  const url = postVideoSource(item);
  if (!url) return;
  const author = item.author || item.user || item.creator || {};
  const handle = author.username || '';
  onProgress?.(0);
  toast.success('Preparing your VANTA video', 'Keep this page open until it finishes');
  try {
    const { blob, mime } = await exportWatermarkedVideo({ url, handle, onProgress });
    await saveBlobToDevice(blob, watermarkFileName(handle, String(item.id || 'post'), mime));
    toast.success('Video saved');
  } catch (reason: any) {
    toast.error('Download failed', reason?.message === 'unsupported' ? 'This browser cannot export branded video' : reason?.message);
  } finally { onProgress?.(null); }
}
