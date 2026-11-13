'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Server, Database, Clock, Activity, Globe, RefreshCw,
  Cpu, Network, AlertTriangle,
} from 'lucide-react';
import { getInfrastructure } from '@/lib/adminApi';
import type { ServerInfrastructure } from '@/types/admin';
import ConsolePanel from '@/components/console/Panel';
import StatusBadge, { statusToneFor } from '@/components/console/StatusBadge';
import { ConsoleErrorState, ConsoleLoading, ConsoleEmptyState } from '@/components/console/States';

export default function InfrastructurePage() {
  const [infra, setInfra] = useState<ServerInfrastructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('vanta_token') || localStorage.getItem('token');
      if (!token) throw new Error('Your admin session is unavailable. Sign in again.');
      const data = await getInfrastructure(token);
      setInfra(data);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load system diagnostics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const services = infra?.services || [];
  const regions = infra?.regions || [];
  const health = String(infra?.overallHealth || 'unknown');

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-console-gold">Operations / System</p>
          <h2 className="text-xl font-semibold tracking-tight text-console-text sm:text-2xl">System health</h2>
          <p className="mt-1 text-sm text-console-text-3">Infrastructure diagnostics and service availability.</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-[11px] text-console-text-3">Updated {updatedAt.toLocaleTimeString()}</span>}
          <button type="button" onClick={() => void fetchData()} disabled={loading}
            className="vc-focus inline-flex min-h-9 items-center gap-2 rounded-[var(--vc-radius)] border border-console-border px-3 text-xs font-semibold text-console-text-2 hover:bg-white/[.04] disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {error ? <ConsoleErrorState title="System diagnostics unavailable" message={error} onRetry={() => void fetchData()} /> :
        loading && !infra ? <ConsoleLoading label="Loading infrastructure diagnostics…" /> :
        !infra ? <ConsoleEmptyState icon={<Server size={19} />} title="No infrastructure snapshot" description="The monitoring endpoint returned no system snapshot." /> : (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 border-y border-console-border py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-console-text-3">Overall status</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge tone={statusToneFor(health)} label={health.replace(/_/g, ' ')} />
                <span className="text-xs text-console-text-3">Uptime {infra.uptime || '—'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-console-text-3">
              <span>Runtime <strong className="ml-1 text-console-text-2">{infra.nodeVersion || '—'}</strong></span>
              <span>Platform <strong className="ml-1 text-console-text-2">{infra.platform || '—'}</strong></span>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'CPU load', value: Number(infra.cpu?.usage || 0), detail: infra.cpu?.cores ? `${infra.cpu.cores} cores` : 'Usage', icon: Cpu },
              { label: 'Memory', value: Number(infra.memory?.percentage || 0), detail: infra.memory ? `${infra.memory.used} GB / ${infra.memory.total} GB` : 'Usage', icon: Database },
              { label: 'Network interfaces', value: Number(infra.network?.incoming || 0), detail: 'Incoming interfaces', icon: Network },
            ].map((metric) => {
              const Icon = metric.icon;
              const bounded = Math.max(0, Math.min(100, metric.value));
              return (
                <article key={metric.label} className="min-w-0 border border-console-border bg-console-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-console-text-3">{metric.label}</span>
                    <Icon size={15} className="text-console-gold" aria-hidden />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-console-text">{metric.label === 'Network interfaces' ? metric.value.toLocaleString() : `${metric.value.toFixed(1)}%`}</p>
                  <p className="mt-1 text-[11px] text-console-text-3">{metric.detail}</p>
                  {metric.label !== 'Network interfaces' && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-console-gold transition-[width]" style={{ width: `${bounded}%` }} /></div>}
                </article>
              );
            })}
          </section>

          <ConsolePanel title="Services" description="Current health reported by the infrastructure endpoint."
            actions={<span className="text-[11px] tabular-nums text-console-text-3">{services.filter((s) => s.status === 'healthy').length} / {services.length} healthy</span>}>
            {services.length === 0 ? <ConsoleEmptyState title="No services reported" description="The monitoring endpoint did not return service records." /> :
              <div className="divide-y divide-console-border">
                {services.map((service) => (
                  <div key={service.name} className="flex min-w-0 items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-console-text-3" aria-hidden />
                      <span className="truncate text-sm text-console-text-2">{service.name}</span>
                    </div>
                    <StatusBadge tone={statusToneFor(service.status)} label={service.status || 'Unknown'} />
                  </div>
                ))}
              </div>}
          </ConsolePanel>

          <ConsolePanel title="Regions" description="Reported edge or service-region latency.">
            {regions.length === 0 ? <ConsoleEmptyState icon={<Globe size={18} />} title="No region data" description="Regional health was not included in this snapshot." /> :
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {regions.map((region) => (
                  <div key={region.name} className="flex items-center justify-between gap-3 border border-console-border px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-console-text-2">{region.name}</p>
                      <div className="mt-1"><StatusBadge tone={statusToneFor(region.status)} label={region.status || 'Unknown'} /></div>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-console-text-3">{Number.isFinite(Number(region.latency)) ? `${region.latency} ms` : '—'}</span>
                  </div>
                ))}
              </div>}
          </ConsolePanel>
          <p className="flex items-center gap-2 text-[11px] text-console-text-3"><Clock size={12} /> Snapshot values reflect the last successful response; this page refreshes only when requested.</p>
        </>
      )}
    </div>
  );
}
