'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, CreditCard, KeyRound, Loader2, ShieldCheck, WalletCards } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { SettingsGroup } from '@/components/settings/SettingsUI';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';

interface WalletSettings {
  hasPin: boolean;
  usdtWalletAddress?: string | null;
}

export default function PaymentsSettingsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [wallet, setWallet] = useState<WalletSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiGet<WalletSettings>('/api/wallets/me', token)
      .then((data) => {
        if (cancelled) return;
        setWallet(data);
        setAddress(data?.usdtWalletAddress || '');
      })
      .catch((error) => {
        if (!cancelled) toast.error('Could not load wallet security', (error as Error)?.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const savePin = async () => {
    if (!token) return;
    if (!/^\\d{4,6}$/.test(pin)) {
      toast.error('Enter a 4–6 digit PIN');
      return;
    }
    if (wallet?.hasPin && !/^\\d{4,6}$/.test(oldPin)) {
      toast.error('Enter your current wallet PIN');
      return;
    }
    setBusy('pin');
    try {
      if (wallet?.hasPin) {
        await apiPost('/api/wallets/pin/update', { oldPin, newPin: pin }, token);
      } else {
        await apiPost('/api/wallets/pin/setup', { pin }, token);
      }
      setWallet((current) => current ? { ...current, hasPin: true } : current);
      setPin('');
      setOldPin('');
      toast.success(wallet?.hasPin ? 'Wallet PIN updated' : 'Wallet PIN created');
    } catch (error) {
      toast.error('Could not save wallet PIN', (error as Error)?.message);
    } finally {
      setBusy(null);
    }
  };

  const saveAddress = async () => {
    if (!token) return;
    const normalized = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
      toast.error('Enter a valid BNB Smart Chain (BEP-20) address');
      return;
    }
    setBusy('address');
    try {
      await apiPost('/api/wallets/address', { address: normalized }, token);
      setAddress(normalized);
      setWallet((current) => current ? { ...current, usdtWalletAddress: normalized } : current);
      toast.success('USDT withdrawal address saved');
    } catch (error) {
      toast.error('Could not save withdrawal address', (error as Error)?.message);
    } finally {
      setBusy(null);
    }
  };

  const inputClass = 'h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6a83f]/55';

  return (
    <div className="space-y-6 pb-24">
      <PageHeader sticky bleed title="Payments & wallet security" back="/settings" />
      <p className="-mt-3 text-sm leading-relaxed text-white/45">
        Secure your VANTA wallet and manage the address used for USDT withdrawals.
      </p>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-44 w-full rounded-xl" />
          <div className="skeleton h-44 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <SettingsGroup icon={KeyRound} title="Wallet PIN" description="Required for protected wallet actions">
            <div className="space-y-3 px-4 py-4">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <ShieldCheck size={15} className={wallet?.hasPin ? 'text-emerald-400' : 'text-amber-300'} />
                {wallet?.hasPin ? 'A wallet PIN is active' : 'No wallet PIN has been set'}
              </div>
              {wallet?.hasPin && (
                <label className="block space-y-1.5">
                  <span className="text-xs text-white/55">Current PIN</span>
                  <input className={inputClass} type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={oldPin} onChange={(event) => setOldPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="Enter current PIN" />
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs text-white/55">{wallet?.hasPin ? 'New PIN' : 'Create PIN'}</span>
                <input className={inputClass} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="4–6 digits" />
              </label>
              <button type="button" onClick={savePin} disabled={busy !== null || !pin} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d6a83f] px-4 text-sm font-semibold text-[#17130a] transition hover:bg-[#e6bb58] disabled:opacity-50">
                {busy === 'pin' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {wallet?.hasPin ? 'Update wallet PIN' : 'Set wallet PIN'}
              </button>
            </div>
          </SettingsGroup>

          <SettingsGroup icon={WalletCards} title="USDT withdrawal address" description="BNB Smart Chain · BEP-20">
            <div className="space-y-3 px-4 py-4">
              <label className="block space-y-1.5">
                <span className="text-xs text-white/55">Wallet address</span>
                <input className={inputClass} type="text" autoComplete="off" spellCheck={false} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" />
              </label>
              <p className="text-[11px] leading-5 text-white/35">Only enter an address you control on BNB Smart Chain. Sending USDT to the wrong network or address may permanently lose funds.</p>
              <button type="button" onClick={saveAddress} disabled={busy !== null || !address.trim() || address.trim() === (wallet?.usdtWalletAddress || '')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.09] disabled:opacity-40">
                {busy === 'address' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save withdrawal address
              </button>
            </div>
          </SettingsGroup>

          <div className="flex gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.045] p-4">
            <ArrowDownToLine size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-white/80">Withdrawals are temporarily unavailable</p>
              <p className="mt-1 text-xs leading-5 text-white/40">Your withdrawal address can be saved securely, but withdrawal requests remain disabled until the backend withdrawal flow is re-enabled and verified.</p>
            </div>
          </div>

          <SettingsGroup icon={CreditCard} title="Purchases">
            <a href="/balance" className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.035]">
              <WalletCards size={17} className="text-white/45" />
              <span className="min-w-0 flex-1">Coins, balance and transaction history</span>
              <span className="text-xs text-[#d6a83f]">Open</span>
            </a>
          </SettingsGroup>
        </>
      )}
    </div>
  );
}
