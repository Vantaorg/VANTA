'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getDashboardStats, getInfrastructure } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import {
  Users, Activity, Radio, Wallet, Flag, ShieldCheck, Gift, Server,
  FileText, RefreshCw, ArrowUpRight, ChevronRight, AlertTriangle,
} from 'lucide-react';
import StatusBadge, { statusToneFor } from '@/components/console/StatusBadge';
import TrendChart from '@/components/console/TrendChart';
import { ConsoleErrorState, ConsoleEmptyState } from '@/components/console/States';
import { fmtNumber, fmtCompact, fmtCompactCurrency, timeAgo } from '@/components/console/format';

type GrowthKey = '7d' | '30d' | '90d' | '12m';

const PERIODS: { key: GrowthKey; label: string; description: string }[] = [
  { key: '7d', label: '7D', description: 'last 7 days' },
  { key: '30d', label: '30D', description: 'last 30 days' },
  { key: '90d', label: '90D', description: 'last 90 days' },
  { key: '12m', label: '12M', description: 'last 12 months' },
];

const WORKSPACES = [
  { href: '/admin/users', label: 'Users', detail: 'Accounts and access', icon: Users },
  { href: '/admin/verification', label: 'Verification', detail: 'Review badge requests', icon: ShieldCheck },
  { href: '/admin/compliance', label: 'Moderation', detail: 'Reports and safety', icon: Flag },
  { href: '/admin/finance', label: 'Finance', detail: 'Payments and payouts', icon: Wallet },
  { href: '/admin/gifts', label: 'Gifts', detail: 'Catalog and pricing', icon: Gift },
  { href: '/admin/infrastructure', label: 'System health', detail: 'Platform diagnostics', icon: Server },
];

const roleTone = (role: string | undefined) => {
  const value = String(role || '').toUpperCase();
  if (['SUPER_ADMIN', 'CEO', 'ADMIN'].includes(value)) return 'gold' as const;
  if (['MODERATOR', 'SUPPORT_AGENT', 'CONTENT_REVIEWER'].includes(value)) return 'info' as const;
  return 'neutral' as const;
};

function Metric({ label, value, note, icon: Icon, highlight = false }: {
  label: string; value: string; note: string; icon: any; highlight?: boolean;
}) {
  return (
    <div className="min-w-0 border-l border-console-border pl-3 first:border-l-0 first:pl-0 sm:pl-4">
      <div className="mb-2 flex items-center gap-1.5 text-console-text-3">
        <Icon size={13} aria-hidden />
        <span className="truncate text-[11px] font-medium">{label}</span>
      </div>
      <p className={cn('truncate text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-[28px]', highlight ? 'text-console-gold' : 'text-console-text')}>{value}</p>
      <p className="mt-2 truncate text-[10px] text-console-text-3 sm:text-[11px]">{note}</p>
    </div>
  );
}

export default function AdminPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [infra, setInfra] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<GrowthKey>('30d');

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    try {
      const [dashboard, infrastructure] = await Promise.all([
        getDashboardStats(token),
        getInfrastructure(token).catch(() => null),
      ]);
      setStats(dashboard);
      setInfra(infrastructure);
    } catch (e: any) {
      setError(e?.message || 'Could not load the platform overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const growth = useMemo(() => {
    const raw = stats?.userGrowth?.[period];
    return Array.isArray(raw)
      ? raw.map((point: any) => ({ label: String(point.date || point.month || ''), value: Number(point.count) || 0 }))
      : [];
  }, [stats, period]);

  if (loading && !stats) {
    return (
      <div className="w-full space-y-8" aria-busy="true">
        <div className="space-y-3">
          <div className="h-7 w-48 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded bg-white/[0.04]" />)}
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return <ConsoleErrorState title="Platform overview unavailable" message={error} onRetry={() => void load()} />;
  }

  const data = stats || {};
  const services = Array.isArray(infra?.services) ? infra.services : [];
  const verificationRaw = data.pendingVerificationRequests ?? data.pendingVerifications;
  const verificationCount = Number(verificationRaw);
  const queues = [
    { label: 'Reports', count: Number(data.pendingReports || 0), known: true, href: '/admin/compliance', icon: Flag },
    { label: 'Verifications', count: verificationCount, known: Number.isFinite(verificationCount), href: '/admin/verification', icon: ShieldCheck },
    { label: 'Withdrawals', count: Number(data.pendingWithdrawals || 0), known: true, href: '/admin/finance', icon: Wallet },
  ];

  return (
    <div className="admin-overview w-full min-w-0 space-y-8 pb-8 sm:space-y-9">
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-console-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-console-text-3">VANTA / ADMINISTRATION</p>
          <h2 className="text-[25px] font-semibold tracking-[-0.035em] text-console-text sm:text-[29px]">Platform overview</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-console-text-3">A live operational view of your community, activity and platform systems.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={refreshing} aria-busy={refreshing || undefined} className="vc-focus inline-flex min-h-9 items-center gap-2 rounded-[var(--vc-radius)] border border-console-border px-3 text-xs font-medium text-console-text-2 transition-colors hover:border-console-border-strong hover:text-console-text disabled:opacity-60">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
          {refreshing ? 'Updating' : 'Refresh data'}
        </button>
      </section>

      <section aria-label="Platform metrics" className="rounded-xl border border-console-border bg-console-bg2/60 px-4 py-5 sm:px-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-console-border">
          <Metric label="Registered users" value={fmtCompact(data.totalUsers)} note="All-time accounts" icon={Users} highlight />
          <Metric label="Active today" value={fmtCompact(data.activeUsersToday)} note={fmtCompact(data.onlineUsers) + ' online now'} icon={Activity} />
          <Metric label="Purchase revenue" value={fmtCompactCurrency(data.revenue)} note="Completed purchases" icon={Wallet} />
          <Metric label="Live streams" value={fmtCompact(data.activeStreams)} note={fmtCompact(data.totalStreams) + ' total streams'} icon={Radio} />
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-console-text-3">Figures reflect the data returned by the admin service. Registered users and total streams are cumulative totals.</p>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)] xl:gap-8">
        <section className="min-w-0" aria-label="User growth">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-console-text">User growth</h3>
              <p className="mt-1 text-xs text-console-text-3">New accounts over the {PERIODS.find((p) => p.key === period)?.description}</p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Growth period">
              {PERIODS.map((item) => (
                <button key={item.key} type="button" onClick={() => setPeriod(item.key)} aria-pressed={period === item.key} className={cn('vc-focus min-h-8 rounded px-2.5 text-[11px] font-semibold transition-colors', period === item.key ? 'bg-console-gold text-console-gold-fg' : 'text-console-text-3 hover:bg-white/[0.04] hover:text-console-text')}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-console-border bg-console-bg2/40 px-3 py-3">
            {growth.length ? (
              <TrendChart data={growth} variant="bar" height={220} formatValue={fmtCompact} ariaLabel={'New user accounts over the ' + PERIODS.find((p) => p.key === period)?.description} />
            ) : (
              <ConsoleEmptyState icon={<Users size={18} />} title="No growth data for this period" description="The reporting service returned no account buckets for this range." />
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {[
              { label: 'Content items', value: data.totalContent, icon: FileText },
              { label: 'Verified users', value: data.verifiedUsers, icon: ShieldCheck },
              { label: 'Gifts sent', value: data.totalGiftsSent, icon: Gift },
            ].map((item) => {
              const Icon = item.icon;
              const known = item.value !== undefined && item.value !== null && Number.isFinite(Number(item.value));
              return <div key={item.label} className="flex min-w-0 items-start gap-2.5"><Icon size={14} className="mt-0.5 shrink-0 text-console-text-3" aria-hidden /><div className="min-w-0"><p className="truncate text-[11px] text-console-text-3">{item.label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-console-text">{known ? fmtCompact(item.value) : '—'}</p></div></div>;
            })}
          </div>
        </section>

        <section className="min-w-0" aria-label="Queues requiring attention">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-console-text">Needs attention</h3>
            <p className="mt-1 text-xs text-console-text-3">Items awaiting an admin decision</p>
          </div>
          <div className="divide-y divide-console-border border-y border-console-border">
            {queues.map((queue) => {
              const Icon = queue.icon;
              return (
                <Link key={queue.label} href={queue.href} className="vc-focus group flex min-h-[68px] items-center gap-3 py-3 transition-colors">
                  <Icon size={16} className={queue.known && queue.count > 0 ? 'shrink-0 text-console-gold' : 'shrink-0 text-console-text-3'} aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-console-text">{queue.label}</span><span className="block text-[11px] text-console-text-3">{queue.known ? (queue.count > 0 ? 'Waiting for review' : 'No pending items') : 'Count unavailable'}</span></span>
                  <span className="text-lg font-semibold tabular-nums text-console-text">{queue.known ? fmtNumber(queue.count) : '—'}</span>
                  <ChevronRight size={14} className="shrink-0 text-console-text-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              );
            })}
          </div>
          <h3 className="mb-3 mt-8 text-sm font-semibold text-console-text">Platform economy</h3>
          <dl className="space-y-3">
            {[{ label: 'Gift volume', value: data.totalGiftVolume }, { label: 'Coin purchases', value: data.coinPurchases }, { label: 'Badge purchases', value: data.badgePurchases }].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3"><dt className="text-xs text-console-text-3">{item.label}</dt><dd className="text-xs font-semibold tabular-nums text-console-text">{fmtNumber(item.value)}</dd></div>
            ))}
          </dl>
          <Link href="/admin/finance" className="vc-focus mt-4 inline-flex items-center gap-1 text-xs font-semibold text-console-gold hover:text-console-gold-hover">Open finance <ArrowUpRight size={13} aria-hidden /></Link>
        </section>
      </div>

      <section aria-label="Admin workspaces">
        <div className="mb-4"><h3 className="text-base font-semibold text-console-text">Workspaces</h3><p className="mt-1 text-xs text-console-text-3">Jump directly into a platform area.</p></div>
        <nav className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 xl:grid-cols-6">
          {WORKSPACES.map((workspace) => {
            const Icon = workspace.icon;
            return <Link key={workspace.href} href={workspace.href} className="vc-focus group flex min-w-0 items-start gap-3 border-t border-console-border py-4 transition-colors hover:border-console-gold"><Icon size={16} className="mt-0.5 shrink-0 text-console-text-3 transition-colors group-hover:text-console-gold" aria-hidden /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-console-text">{workspace.label}</span><span className="mt-1 block text-[10px] leading-relaxed text-console-text-3">{workspace.detail}</span></span><ArrowUpRight size={12} className="ml-auto mt-0.5 shrink-0 text-console-text-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></Link>;
          })}
        </nav>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-2 xl:gap-8">
        <section className="min-w-0" aria-label="Recent signups">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-console-text">Recent signups</h3><p className="mt-1 text-xs text-console-text-3">Newest accounts on VANTA</p></div><Link href="/admin/users" className="vc-focus shrink-0 text-xs font-semibold text-console-gold hover:text-console-gold-hover">All users <ChevronRight size={12} className="inline" aria-hidden /></Link></div>
          {!Array.isArray(data.recentUsers) || data.recentUsers.length === 0 ? (
            <div className="border-y border-console-border py-4"><ConsoleEmptyState icon={<Users size={17} />} title="No recent signups" description="No recent account data was returned." /></div>
          ) : (
            <ul className="divide-y divide-console-border border-y border-console-border">
              {data.recentUsers.slice(0, 5).map((user: any) => (
                <li key={user.id}><Link href={'/admin/users?search=' + encodeURIComponent(user.username || '')} className="vc-focus flex items-center gap-3 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-xs font-semibold text-console-text-2">{(user.username || '?').charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-console-text">@{user.username}</span><span className="mt-1 block truncate text-[10px] text-console-text-3">{user.fullName ? user.fullName + ' · ' : ''}{timeAgo(user.createdAt)}</span></span><StatusBadge tone={roleTone(user.role)} label={String(user.role || 'USER')} /></Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0" aria-label="Service health">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-console-text">Service health</h3><p className="mt-1 text-xs text-console-text-3">Infrastructure snapshot</p></div><Link href="/admin/infrastructure" className="vc-focus shrink-0 text-xs font-semibold text-console-gold hover:text-console-gold-hover">Diagnostics <ChevronRight size={12} className="inline" aria-hidden /></Link></div>
          {services.length ? (
            <div className="grid grid-cols-1 gap-x-5 divide-y divide-console-border border-y border-console-border sm:grid-cols-2 sm:divide-y-0">
              {services.slice(0, 8).map((service: any) => (
                <div key={service.name} className="flex min-w-0 items-center gap-2.5 border-b border-console-border py-3 last:border-b-0 sm:odd:pr-3 sm:even:pl-3"><StatusBadge tone={statusToneFor(service.status)} label={String(service.status || 'unknown')} pulse={service.status === 'degraded'} /><span className="min-w-0 truncate text-xs text-console-text-2" title={service.name}>{service.name}</span></div>
              ))}
            </div>
          ) : (
            <div className="border-y border-console-border py-4"><ConsoleEmptyState icon={<Server size={17} />} title="Service health unavailable" description="The diagnostics endpoint did not return service data. Open system diagnostics for more detail." action={<Link href="/admin/infrastructure" className="vc-focus mt-2 inline-flex items-center gap-1 text-xs font-semibold text-console-gold">Open diagnostics <ArrowUpRight size={12} aria-hidden /></Link>} /></div>
          )}
        </section>
      </div>

      {Array.isArray(data.recentReports) && data.recentReports.length > 0 ? (
        <section aria-label="Recent moderation reports">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-console-text">Recent reports</h3><p className="mt-1 text-xs text-console-text-3">Latest community safety reports</p></div><Link href="/admin/compliance" className="vc-focus shrink-0 text-xs font-semibold text-console-gold hover:text-console-gold-hover">Moderation queue <ChevronRight size={12} className="inline" aria-hidden /></Link></div>
          <ul className="divide-y divide-console-border border-y border-console-border">
            {data.recentReports.slice(0, 4).map((report: any) => (
              <li key={report.id} className="flex items-center gap-3 py-3"><AlertTriangle size={15} className="shrink-0 text-console-text-3" aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-console-text">{report.reason || report.category || 'Report'}</span><span className="mt-1 block text-[10px] text-console-text-3">{timeAgo(report.createdAt)}</span></span><StatusBadge tone={statusToneFor(report.status)} label={String(report.status || 'PENDING')} /></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
