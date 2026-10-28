'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useContentCreation } from '@/components/create/ContentCreationContext';
import VerificationBadge from '@/components/ui/VerificationBadge';
import { apiGet } from '@/lib/apiClient';
import { GO_LIVE_ROUTE } from '@/lib/goLiveEntry';
import type { CreatorStats, CreatorContentItem } from '@/lib/creatorStudio';
import { ConsoleErrorState } from '@/components/console/States';
import { fmtCompact, fmtCurrency, timeAgo } from '@/components/console/format';
import { Eye, Heart, Users, Radio, Gift, Coins, Video, FileText, ArrowUpRight, Plus, TrendingUp, Wallet, ChevronRight } from 'lucide-react';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};
const QUICK_ACTIONS = [
  { href: GO_LIVE_ROUTE, label: 'Go live', desc: 'Start a live session', icon: Radio },
  { href: '/creator/content', label: 'Your content', desc: 'Manage posts and reels', icon: FileText },
  { href: '/creator/analytics', label: 'Analytics', desc: 'Understand your reach', icon: TrendingUp },
  { href: '/creator/earnings', label: 'Earnings', desc: 'Wallet and transactions', icon: Wallet },
];

export default function CreatorStudioPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { openPostModal } = useContentCreation();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [content, setContent] = useState<CreatorContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [statsRes, contentRes] = await Promise.all([
        apiGet<{ stats: CreatorStats }>('/api/creator/stats', token),
        apiGet<{ content: CreatorContentItem[] }>('/api/creator/content?limit=5', token, { skipCache: true }).catch(() => ({ content: [] as CreatorContentItem[] })),
      ]);
      setStats(statsRes?.stats ?? null);
      setContent(Array.isArray(contentRes?.content) ? contentRes.content : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load your studio overview.');
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) return <div className="w-full space-y-8 pb-10" aria-busy="true">
    <div className="space-y-3"><div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" /><div className="h-8 w-56 animate-pulse rounded bg-white/[0.06]" /><div className="h-4 w-64 animate-pulse rounded bg-white/[0.04]" /></div>
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-20 animate-pulse rounded bg-white/[0.04]" />)}</div>
    <div className="h-40 animate-pulse rounded bg-white/[0.03]" />
  </div>;
  if (error) return <ConsoleErrorState title="Couldn't load your overview" message={error} onRetry={() => void fetchData()} />;

  const displayName = stats?.fullName || stats?.username || user?.username || 'Creator';
  const recent = content.slice(0, 4);

  return <div className="w-full min-w-0 space-y-8 pb-10 sm:space-y-10">
    <section className="flex flex-col gap-5 border-b border-console-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-console-text-3">{greeting()}</p>
        <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-console-text sm:text-3xl"><span className="truncate">{displayName}</span>{stats?.verified ? <VerificationBadge /> : null}</h2>
        <p className="mt-2 text-sm text-console-text-3">Your creative space, all in one place.</p>
      </div>
      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
        <button type="button" onClick={() => openPostModal()} className="vc-focus inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-console-border-strong px-4 text-sm font-semibold text-console-text-2 transition-colors hover:bg-white/[0.04] hover:text-console-text sm:flex-none"><Plus size={16} aria-hidden /> Create</button>
        <button type="button" onClick={() => router.push(GO_LIVE_ROUTE)} className="vc-focus inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-console-gold px-5 text-sm font-semibold text-console-gold-fg transition-colors hover:bg-console-gold-hover sm:flex-none"><Radio size={16} aria-hidden /> Go live</button>
      </div>
    </section>

    {stats ? <section aria-label="Your performance" className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-console-text">Your performance</h3><Link href="/creator/analytics" className="vc-focus inline-flex items-center gap-1 text-xs font-medium text-console-gold hover:text-console-gold-hover">Analytics <ArrowUpRight size={13} aria-hidden /></Link></div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4 sm:gap-x-8">
        <Metric icon={<Users size={15}/>} label="Followers" value={fmtCompact(stats.totalFollowers)} hint={`${fmtCompact(stats.totalFollowing)} following`} />
        <Metric icon={<Eye size={15}/>} label="Views" value={fmtCompact(stats.totalViews)} hint={`${fmtCompact(stats.totalPosts)} posts · ${fmtCompact(stats.totalReels)} reels`} />
        <Metric icon={<Heart size={15}/>} label="Engagement" value={fmtCompact(stats.totalLikes)} hint={`${fmtCompact(stats.totalComments)} comments · ${fmtCompact(stats.totalShares)} shares`} />
        <Metric icon={<Gift size={15}/>} label="Gifts received" value={fmtCompact(stats.giftsReceived)} hint={`${fmtCompact(stats.coins)} coins balance`} />
      </div><p className="text-[11px] text-console-text-3">Lifetime totals from your content, live sessions and wallet.</p>
    </section> : null}

    <section className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)] xl:gap-10">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-console-text">Recent content</h3><p className="mt-1 text-xs text-console-text-3">Your latest posts and reels</p></div><Link href="/creator/content" className="vc-focus inline-flex shrink-0 items-center gap-1 text-xs font-medium text-console-gold hover:text-console-gold-hover">View all <ChevronRight size={14} aria-hidden /></Link></div>
        {recent.length === 0 ? <div className="flex min-h-40 flex-col items-start justify-center border-y border-console-border py-6"><FileText size={20} className="mb-3 text-console-text-3" aria-hidden /><p className="text-sm font-medium text-console-text">Your content starts here</p><p className="mt-1 text-xs text-console-text-3">Publish a post or reel and its performance will appear here.</p><button type="button" onClick={() => openPostModal()} className="vc-focus mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-console-gold px-4 text-xs font-semibold text-console-gold-fg hover:bg-console-gold-hover"><Plus size={14} aria-hidden /> Create a post</button></div> :
          <ul className="divide-y divide-console-border border-y border-console-border">{recent.map(item => <li key={item.id}><Link href={`/post/${item.id}`} className="vc-focus flex min-w-0 items-center gap-3 py-3.5 transition-colors hover:bg-white/[0.02]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-console-text-3">{item.type === 'reel' ? <Video size={16}/> : <FileText size={16}/>}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-console-text">{item.title}</span><span className="mt-1 flex items-center gap-2 text-[11px] text-console-text-3"><span className="uppercase">{item.type}</span><span aria-hidden>·</span><span>{timeAgo(item.createdAt)}</span></span></span>
            <span className="hidden shrink-0 items-center gap-4 text-xs text-console-text-3 sm:flex"><span><strong className="font-semibold text-console-text-2">{fmtCompact(item.views)}</strong> views</span><span><strong className="font-semibold text-console-text-2">{fmtCompact(item.likes)}</strong> likes</span></span><span className="flex shrink-0 items-center gap-1 text-xs text-console-text-2 sm:hidden"><Eye size={12}/>{fmtCompact(item.views)}</span><ArrowUpRight size={14} className="shrink-0 text-console-text-3" />
          </Link></li>)}</ul>}
      </div>

      <div className="min-w-0 space-y-8">
        <div><h3 className="mb-3 text-sm font-semibold text-console-text">Shortcuts</h3><nav aria-label="Creator shortcuts" className="divide-y divide-console-border border-y border-console-border">{QUICK_ACTIONS.map(action => { const Icon = action.icon; return <Link key={action.href} href={action.href} className="vc-focus group flex min-h-[58px] items-center gap-3 py-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-console-text-3 group-hover:text-console-gold"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-console-text">{action.label}</span><span className="mt-0.5 block text-xs text-console-text-3">{action.desc}</span></span><ChevronRight size={15} className="shrink-0 text-console-text-3 group-hover:text-console-gold" /></Link>; })}</nav></div>
        {stats ? <div><h3 className="mb-3 text-sm font-semibold text-console-text">Live & wallet</h3><dl className="space-y-3 border-y border-console-border py-4">
          <Balance icon={<Radio size={14}/>} label="Live sessions" value={fmtCompact(stats.totalLiveSessions)} />
          <Balance icon={<Coins size={14}/>} label="Coin balance" value={fmtCompact(stats.coins)} />
          <Balance icon={<Wallet size={14}/>} label="Earnings balance" value={fmtCurrency(stats.earningsBalance)} gold />
        </dl><Link href="/creator/earnings" className="vc-focus mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-console-gold hover:text-console-gold-hover">Open monetization <ArrowUpRight size={13} /></Link></div> : null}
      </div>
    </section>
  </div>;
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-console-text-3">{icon}<span className="text-xs">{label}</span></div><p className="text-2xl font-semibold tracking-tight tabular-nums text-console-text sm:text-3xl">{value}</p><p className="mt-1 text-[11px] text-console-text-3">{hint}</p></div>;
}
function Balance({ icon, label, value, gold = false }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2 text-xs text-console-text-3">{icon}{label}</dt><dd className={`text-sm font-semibold tabular-nums ${gold ? 'text-console-gold' : 'text-console-text'}`}>{value}</dd></div>;
}
