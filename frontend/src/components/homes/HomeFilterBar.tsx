'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface HomeFilterBarProps {
  propertyTypes: string[];
  rentPeriods: string[];
  current: Record<string, string>;
}

const TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', FLAT: 'Flat',
  DETACHED_HOUSE: 'Detached House', SEMI_DETACHED_HOUSE: 'Semi-Detached House',
  DUPLEX: 'Duplex', ROOM_SHARED: 'Shared Room', OTHER: 'Other',
};

export function HomeFilterBar({ propertyTypes, rentPeriods, current }: HomeFilterBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(current.q || '');
  const [draftMinRent, setDraftMinRent] = useState(current.minRent || '');
  const [draftMaxRent, setDraftMaxRent] = useState(current.maxRent || '');
  useEffect(() => setSearch(current.q || ''), [current.q]);
  useEffect(() => {
    setDraftMinRent(current.minRent || '');
    setDraftMaxRent(current.maxRent || '');
  }, [current.minRent, current.maxRent]);
  const hasFilters =
    current.city || current.area || current.propertyType || current.minRent || current.maxRent || current.bedrooms || current.bathrooms || current.furnished || current.q || (current.sort && current.sort !== 'newest');

  const buildUrl = (updates: Partial<Record<string, string>>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === '') params.delete(k);
      else params.set(k, v);
    });
    window.location.search = params.toString();
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full min-w-0 items-center gap-2 sm:max-w-2xl">
        <Input
          placeholder="City, neighbourhood or keyword"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="w-full min-w-0 bg-[#171d25] border border-white/[0.08] text-white placeholder-white/35"
        />
        <Button variant="gold" size="sm" onClick={() => buildUrl({ q: search.trim() })}>
          Search
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setSearch(''); buildUrl({ q: '', city: '', area: '' }); }} disabled={!search && !current.q && !current.city && !current.area}>
          Clear
        </Button>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex min-h-9 items-center gap-2 rounded-lg border border-white/[.09] bg-white/[.035] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[.07] sm:text-sm"
        >
          Filters <span className="text-[#c9a227]">{hasFilters ? '· active' : ''}</span>
        </button>
        <Button variant="outline" size="sm" onClick={() => { window.location.search = ''; }} disabled={!hasFilters}>
          Reset
        </Button>
      </div>
      </div>

      {open && (
        <div className="w-full rounded-xl border border-white/[.08] bg-[#171d25] p-3.5 sm:p-4">
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <FilterSelect label="Property type" name="propertyType" options={propertyTypes.map((t) => ({ value: t, label: TYPE_LABEL[t] || t }))} current={current.propertyType || ''} buildUrl={buildUrl} />
            <FilterSelect label="Bedrooms" name="bedrooms" options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v === '4' ? '4+' : v }))} current={current.bedrooms || ''} buildUrl={buildUrl} />
            <FilterSelect label="Bathrooms" name="bathrooms" options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v === '4' ? '4+' : v }))} current={current.bathrooms || ''} buildUrl={buildUrl} />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <FilterInput label="Min rent" value={draftMinRent} onChange={setDraftMinRent} />
            <FilterInput label="Max rent" value={draftMaxRent} onChange={setDraftMaxRent} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FilterSelect label="Furnished" name="furnished" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} current={current.furnished || ''} buildUrl={buildUrl} />
            <FilterSelect label="Sort by" name="sort" options={[{ value: 'newest', label: 'Newest' }, { value: 'price_asc', label: 'Price: low to high' }, { value: 'price_desc', label: 'Price: high to low' }]} current={current.sort || 'newest'} buildUrl={buildUrl} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDraftMinRent(''); setDraftMaxRent(''); window.location.search = ''; }}>Clear all</Button>
            <Button variant="gold" size="sm" onClick={() => buildUrl({ minRent: draftMinRent.trim(), maxRent: draftMaxRent.trim() })}>Apply filters</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, name, options, current, buildUrl }: { label: string; name: string; options: { value: string; label: string }[]; current: string; buildUrl: (u: Partial<Record<string, string>>) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-white/50">{label}</span>
      <select value={current} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => buildUrl({ [name]: e.target.value })} className="w-full rounded-lg border border-white/[.09] bg-[#10151c] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]/60 focus:ring-2 focus:ring-[#c9a227]/10">
        <option value="">Any</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-white/50">{label}</span>
      <input type="number" min="0" value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} className="w-full rounded-lg border border-white/[.09] bg-[#10151c] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]/60 focus:ring-2 focus:ring-[#c9a227]/10" />
    </div>
  );
}