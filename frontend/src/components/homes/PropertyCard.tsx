'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';
import { useToast } from '@/components/ui/Toast';
import { toggleSaveHome } from '@/lib/services';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { MapPin, Bed, Bath, Home, Play, Bookmark } from 'lucide-react';

export interface PropertyCardProps { listing: any; }

const resolveHomeMediaUrl = (media: any): string | null => {
  const raw = media?.uploadedFile?.url || media?.url || media?.thumbnailUrl || media?.uploadedFile?.thumbnailUrl;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  try { return new URL(value.startsWith('/') ? value : `/${value}`, API_BASE_URL).toString(); } catch { return value; }
};

const PERIOD_LABEL: Record<string, string> = { WEEKLY: '/week', MONTHLY: '/month', YEARLY: '/year' };
const TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', FLAT: 'Flat',
  DETACHED_HOUSE: 'Detached house', SEMI_DETACHED_HOUSE: 'Semi-detached house',
  DUPLEX: 'Duplex', ROOM_SHARED: 'Shared room', OTHER: 'Other',
};

export default function PropertyCard({ listing }: PropertyCardProps) {
  const { formatCurrency } = useI18n();
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<boolean>(Boolean(listing.isSaved));
  const [saving, setSaving] = useState(false);
  const cover = Array.isArray(listing.media) ? [...listing.media].sort((a, b) => Number(Boolean(b.isCover)) - Number(Boolean(a.isCover)) || (a.order ?? 0) - (b.order ?? 0))[0] : null;
  const coverUrl = resolveHomeMediaUrl(cover);
  const price = formatCurrency(listing.rentAmount, listing.currency || 'NGN');
  const period = PERIOD_LABEL[listing.rentPeriod || 'MONTHLY'] || '/month';
  const type = TYPE_LABEL[listing.propertyType || 'OTHER'] || 'Other';

  const handleSave = async () => {
    if (!user) {
      showToast({ type: 'error', title: 'Login required', message: 'Please log in to save properties.' });
      return;
    }
    if (saving) return;
    const previous = saved;
    setSaved(!previous);
    setSaving(true);
    try {
      const result = await toggleSaveHome(listing.id, token);
      setSaved(Boolean(result?.saved));
      showToast({ type: 'success', title: result?.saved ? 'Saved to your homes' : 'Removed from saved homes' });
    } catch (e: any) {
      setSaved(previous);
      showToast({ type: 'error', title: 'Could not update saved homes', message: e?.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (listing.loading) return <div className="animate-pulse"><div className="aspect-[4/3] rounded-xl bg-white/[.06]" /><div className="mt-3 h-4 w-2/3 rounded bg-white/[.06]" /><div className="mt-2 h-4 w-1/3 rounded bg-white/[.06]" /></div>;

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[1/1] overflow-hidden rounded-none bg-[#111] sm:aspect-[4/3] sm:rounded-lg">
        <Link href={'/homes/' + listing.id} className="absolute inset-0 block" aria-label={'View ' + listing.title}>
          {coverUrl ? <img src={coverUrl} alt={listing.title || 'Property photo'} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('home-media-failed'); }} /> : <div className="flex h-full w-full items-center justify-center text-white/25"><Home size={32} strokeWidth={1.4} /></div>}
          {cover?.type === 'VIDEO' && <span className="absolute inset-0 flex items-center justify-center bg-black/25"><Play size={28} className="text-white" /></span>}
        </Link>
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-4rem)] truncate rounded bg-black/65 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">{type}</span>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227] disabled:opacity-60" aria-label={saved ? 'Remove from saved homes' : 'Save this property'} aria-pressed={saved}>
          <Bookmark size={17} fill={saved ? '#c9a227' : 'none'} className={saved ? 'text-[#c9a227]' : ''} />
        </button>
      </div>
      <div className="px-2.5 pt-2.5 pb-1 sm:px-0 sm:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={'/homes/' + listing.id} className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c9a227]"><h3 className="line-clamp-1 text-sm font-semibold leading-5 text-white transition group-hover:text-[#e4c65d]">{listing.title}</h3></Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-white/50"><MapPin size={13} className="shrink-0" /><span className="truncate">{[listing.area, listing.city].filter(Boolean).join(', ') || 'Location not specified'}</span></p>
          </div>
          <div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums text-[#e4c65d]">{price}</p><p className="mt-0.5 text-[11px] text-white/40">{period}</p></div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-white/[.06] pt-2 text-[10px] text-white/55 sm:text-[11px]">
          <span className="inline-flex items-center gap-1.5"><Bed size={14} /> {listing.bedrooms ?? '—'} beds</span>
          <span className="inline-flex items-center gap-1.5"><Bath size={14} /> {listing.bathrooms ?? '—'} baths</span>
          {listing.furnished && <span>Furnished</span>}
          <Link href={'/homes/' + listing.id} className="ml-auto inline-flex min-h-7 items-center text-[11px] font-semibold text-white/75 transition hover:text-[#e4c65d]">View property <span className="ml-1" aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}
