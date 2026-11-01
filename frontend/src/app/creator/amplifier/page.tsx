'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/apiClient';
import { ConsoleErrorState } from '@/components/console/States';
import { fmtCompact, timeAgo } from '@/components/console/format';
import { ArrowUpRight, BarChart3, Check, Copy, ExternalLink, FileText, Megaphone, Share2, Video } from 'lucide-react';

type ContentItem = {
  id: string;
  title?: string;
  type?: string;
  createdAt?: string;
  views?: number;
  likes?: number;
  comments?: number;
};

export default function CreatorAmplifierPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ content?: ContentItem[] }>('/api/creator/content?limit=30', token, { skipCache: true });
      setItems(Array.isArray(result?.content) ? result.content : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load your published content.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const publicUrl = (item: ContentItem) => {
    if (typeof window === 'undefined') return '';
    return new URL(item.type?.toLowerCase() === 'reel' ? `/reels/${item.id}` : `/post/${item.id}`, window.location.origin).toString();
  };

  const copyLink = async (item: ContentItem) => {
    try {
      await navigator.clipboard.writeText(publicUrl(item));
      setCopiedId(item.id);
      setNotice('Content link copied. Share it with your audience.');
      window.setTimeout(() => setCopiedId(current => current === item.id ? null : current), 2200);
    } catch {
      setNotice('Copy was blocked by your browser. Open the content and copy its link from the address bar.');
    }
  };

  const shareItem = async (item: ContentItem) => {
    const url = publicUrl(item);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title || 'Check out my content on VANTA', url });
      } else {
        await copyLink(item);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setNotice('Sharing is unavailable here. Try copying the link instead.');
    }
  };

  if (loading) return <div className="w-full space-y-6 pb-10" aria-busy="true"><div className="h-24 animate-pulse bg-white/[0.04]" /><div className="h-16 animate-pulse bg-white/[0.03]" /><div className="h-16 animate-pulse bg-white/[0.03]" /></div>;
  if (error) return <ConsoleErrorState title="Couldn't load Amplifier" message={error} onRetry={() => void load()} />;

  return <div className="w-full min-w-0 space-y-8 pb-10">
    <section className="border-b border-console-border pb-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-console-gold">Creator growth</p>
      <div className="mt-2 flex items-start gap-3">
        <Megaphone size={24} className="mt-1 shrink-0 text-console-gold" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-console-text sm:text-3xl">Amplifier</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-console-text-3">Help more people discover your work. Share your published posts and Reels, then use Analytics to understand what resonates.</p>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-5 sm:grid-cols-3" aria-label="Ways to grow">
      <div className="border-b border-console-border pb-4 sm:border-b-0 sm:border-r sm:pr-5"><Share2 size={18} className="mb-3 text-console-gold" /><h3 className="text-sm font-semibold text-console-text">Share your work</h3><p className="mt-1 text-xs leading-5 text-console-text-3">Send direct links to your published content on the platforms and chats you already use.</p></div>
      <div className="border-b border-console-border pb-4 sm:border-b-0 sm:border-r sm:pr-5"><BarChart3 size={18} className="mb-3 text-console-gold" /><h3 className="text-sm font-semibold text-console-text">Learn what works</h3><p className="mt-1 text-xs leading-5 text-console-text-3">Review views and engagement in Creator Analytics and repeat the formats your audience enjoys.</p><Link href="/creator/analytics" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-console-gold">Open analytics <ArrowUpRight size={13} /></Link></div>
      <div className="pb-2"><FileText size={18} className="mb-3 text-console-gold" /><h3 className="text-sm font-semibold text-console-text">Keep publishing</h3><p className="mt-1 text-xs leading-5 text-console-text-3">A consistent schedule gives your audience a reason to return.</p><Link href="/creator/content" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-console-gold">Manage content <ArrowUpRight size={13} /></Link></div>
    </section>

    {notice && <p role="status" className="text-xs text-console-gold">{notice}</p>}

    <section aria-label="Published content">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-console-text">Your published content</h3><p className="mt-1 text-xs text-console-text-3">Share a post or Reel to bring it to more people.</p></div><span className="text-xs tabular-nums text-console-text-3">{items.length} items</span></div>
      {items.length === 0 ? <div className="border-y border-console-border py-8"><p className="text-sm font-medium text-console-text">Nothing published yet</p><p className="mt-1 text-xs text-console-text-3">Publish your first post or Reel, then return here to share it.</p><Link href="/creator/content" className="mt-4 inline-flex min-h-10 items-center gap-2 bg-console-gold px-4 text-xs font-semibold text-console-gold-fg">Open content manager <ArrowUpRight size={14} /></Link></div> :
      <ul className="divide-y divide-console-border border-y border-console-border">{items.map(item => <li key={item.id} className="flex min-w-0 items-center gap-3 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center bg-white/[0.04] text-console-text-3">{item.type?.toLowerCase() === 'reel' ? <Video size={17} /> : <FileText size={17} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-console-text">{item.title || (item.type?.toLowerCase() === 'reel' ? 'Reel' : 'Post')}</p><p className="mt-1 text-[11px] text-console-text-3">{fmtCompact(Number(item.views || 0))} views · {fmtCompact(Number(item.likes || 0))} likes{item.createdAt ? ` · ${timeAgo(item.createdAt)}` : ''}</p></div>
        <Link href={item.type?.toLowerCase() === 'reel' ? `/reels/${item.id}` : `/post/${item.id}`} aria-label="Open content" className="grid h-9 w-9 shrink-0 place-items-center text-console-text-3 hover:text-console-gold"><ExternalLink size={16} /></Link>
        <button type="button" onClick={() => void shareItem(item)} aria-label="Share content" className="grid h-9 w-9 shrink-0 place-items-center text-console-text-2 hover:text-console-gold"><Share2 size={16} /></button>
        <button type="button" onClick={() => void copyLink(item)} aria-label="Copy content link" className="grid h-9 w-9 shrink-0 place-items-center text-console-text-2 hover:text-console-gold">{copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}</button>
      </li>)}</ul>}
    </section>
    <p className="text-[11px] leading-5 text-console-text-3">Amplifier currently provides organic sharing tools. Paid promotion and guaranteed reach are not offered here, so no charges are made from this page.</p>
  </div>;
}
