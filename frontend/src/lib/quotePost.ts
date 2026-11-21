// Quote posts are client-rendered: the backend has no quote reference field, so a
// quote is a normal post whose content ends with the source post's VANTA URL.
// These helpers find that URL so the UI can render a rich embed instead.
export type QuoteRef = { kind: 'post' | 'reel'; id: string; url: string; path: string };

const QUOTE_URL = /https?:\/\/[^\s<>"']+?\/(post|reels)\/([A-Za-z0-9_-]+)(?=[\s<>"']|$)/gi;

// Returns the LAST same-origin VANTA post/reel link in the text, if any.
export function extractQuoteRef(text: string, host?: string): { ref: QuoteRef; rest: string } | null {
  if (!text || !host) return null;
  let found: RegExpExecArray | null = null;
  QUOTE_URL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUOTE_URL.exec(text)) !== null) {
    try { if (new URL(m[0]).host === host) found = m; } catch { /* ignore */ }
  }
  if (!found) return null;
  const kind = found[1].toLowerCase() === 'reels' ? 'reel' : 'post';
  const id = found[2];
  const rest = (text.slice(0, found.index) + text.slice(found.index + found[0].length)).trim();
  return { ref: { kind, id, url: found[0], path: kind === 'reel' ? `/reels/${id}` : `/post/${id}` }, rest };
}
