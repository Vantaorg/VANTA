'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarClock, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { accountApi } from '@/lib/complianceApi';
import { AccountNoticeShell, CenteredSpinner, InlineStatus, NoticeRows } from '../AccountNotice';

export default function DeactivatedAccountPage() {
  const router = useRouter();
  const { token, refreshToken, user, isLoading: authLoading, updateUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token && !refreshToken) {
      router.replace('/login');
      return;
    }
    if (user?.status === 'ACTIVE') router.replace('/reels');
  }, [authLoading, token, refreshToken, user?.status, router]);

  useEffect(() => {
    if (!token || authLoading) return;
    accountApi.getStatus().then(setStatus).catch((caught: any) => {
      setError(caught?.message || 'Could not load your account recovery details.');
    });
  }, [token, authLoading]);

  const reactivate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await accountApi.cancelDeletion();
      await updateUser({ status: 'ACTIVE' });
      router.replace('/reels');
    } catch (caught: any) {
      setError(caught?.message || 'We could not reactivate your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  if (authLoading || !token) {
    return (
      <AccountNoticeShell
        eyebrow="VANTA / ACCOUNT RECOVERY"
        icon={<RefreshCw size={24} />}
        title="Checking your account"
        description="Please wait while we restore your secure session."
      >
        <CenteredSpinner label="Loading account status…" />
      </AccountNoticeShell>
    );
  }

  const isScheduled = status?.status === 'SCHEDULED_FOR_DELETION';
  const recoveryDate = isScheduled ? status?.scheduledFor : status?.recoveryPeriodEnd;

  return (
    <AccountNoticeShell
      eyebrow="VANTA / ACCOUNT RECOVERY"
      icon={<AlertTriangle size={24} />}
      title={isScheduled ? 'Deletion is scheduled' : 'Your account is deactivated'}
      description={
        isScheduled
          ? 'Your account is restricted while the scheduled deletion is pending. You can cancel the deletion before the scheduled date.'
          : 'Your account is temporarily disabled. Reactivate it during the recovery period to restore normal access.'
      }
    >
      {status && (
        <NoticeRows rows={[
          { label: 'Account status', value: isScheduled ? 'Scheduled for deletion' : 'Deactivated' },
          recoveryDate ? { label: isScheduled ? 'Deletion date' : 'Recovery deadline', value: new Date(recoveryDate).toLocaleString() } : null,
        ]} />
      )}
      {error && <InlineStatus tone="danger">{error}</InlineStatus>}
      <button
        type="button"
        onClick={reactivate}
        disabled={busy || status?.status === 'DELETED'}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
        {busy ? 'Reactivating…' : isScheduled ? 'Cancel deletion and reactivate' : 'Reactivate account'}
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"
      >
        <LogOut size={15} /> Sign out
      </button>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/35">
        <CalendarClock size={13} /> Your account remains restricted until you reactivate it.
      </p>
    </AccountNoticeShell>
  );
}
