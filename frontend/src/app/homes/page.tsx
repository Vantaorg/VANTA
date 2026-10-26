import { fetchHomes, fetchHomePropertyTypes, fetchHomeRentPeriods } from '@/lib/services';
import { HomeFilterBar } from '@/components/homes/HomeFilterBar';
import EmptyState from '@/components/ui/EmptyState';
import { PostHomeButton } from '@/components/homes/PostHomeButton';
import HomesResults from '@/components/homes/HomesResults';
import { ArrowRight, Building2, HeartHandshake, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

const PAGE_LIMIT = 20;

export const metadata = {
  title: 'VANTA Homes — Find a place to call home',
  description: 'Discover homes and apartments for rent on VANTA.',
};

export default async function HomesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params: Record<string, string> = {};
  const setIf = (key: string, val: string | string[] | undefined) => {
    if (val !== undefined && val !== '') params[key] = Array.isArray(val) ? val[0] : val;
  };
  setIf('city', searchParams.city);
  setIf('area', searchParams.area);
  setIf('propertyType', searchParams.propertyType);
  setIf('minRent', searchParams.minRent);
  setIf('maxRent', searchParams.maxRent);
  setIf('bedrooms', searchParams.bedrooms);
  setIf('bathrooms', searchParams.bathrooms);
  setIf('furnished', searchParams.furnished);
  setIf('q', searchParams.q);
  if (params.q) params.search = params.q;
  setIf('sort', searchParams.sort || 'newest');
  params.limit = String(PAGE_LIMIT);

  let propertyTypes: string[] = [];
  let rentPeriods: string[] = [];
  try { propertyTypes = (await fetchHomePropertyTypes())?.propertyTypes || []; } catch {}
  try { rentPeriods = (await fetchHomeRentPeriods())?.rentPeriods || []; } catch {}

  let data: any = { data: [], nextCursor: null, hasMore: false };
  try {
    const res = await fetchHomes(params);
    data = res || data;
  } catch { data = { data: [], nextCursor: null, hasMore: false }; }

  const quickTypes = [
    { label: 'Apartments', value: 'APARTMENT' },
    { label: 'Flats', value: 'FLAT' },
    { label: 'Studios', value: 'STUDIO' },
    { label: 'Duplexes', value: 'DUPLEX' },
  ];

  return (
    <main className="min-h-[var(--vanta-vh,100dvh)] overflow-hidden bg-[#080808] text-white">
      <section className="relative isolate border-b border-white/[0.08]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-36 right-[-8%] h-[26rem] w-[26rem] rounded-full bg-[#c9a227]/[0.12] blur-[100px]" />
          <div className="absolute bottom-[-12rem] left-[-8%] h-[25rem] w-[25rem] rounded-full bg-[#c9a227]/[0.06] blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'linear-gradient(to bottom, black, transparent 85%)' }} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pb-12 sm:pt-8">
          <nav className="mb-10 flex items-center justify-between gap-4 sm:mb-14" aria-label="Homes navigation">
            <a href="/homes" className="flex min-w-0 items-center gap-3" aria-label="VANTA Homes home">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#c9a227]/35 bg-[#c9a227]/10 text-[#c9a227]"><Building2 size={21} /></span>
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#c9a227]">VANTA</span>
                <span className="block text-sm font-semibold text-white">Homes</span>
              </span>
            </a>
            <div className="flex shrink-0 items-center gap-2">
              <a href="/homes/manage" className="hidden rounded-xl px-3 py-2 text-sm text-white/65 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex">My listings</a>
              <PostHomeButton />
            </div>
          </nav>

          <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-12">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c9a227]/25 bg-[#c9a227]/[0.08] px-3 py-1.5 text-xs font-medium text-[#e2c45f]">
                <Sparkles size={14} /> A better way to find your place
              </div>
              <h1 className="max-w-xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Your next chapter starts <span className="text-[#d7b548]">at home.</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                Explore places that fit your life and budget. Discover rentals, compare the details, and connect with property owners — all in VANTA.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/55 sm:text-sm">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#c9a227]" /> Owner details and listing status</span>
                <span className="inline-flex items-center gap-2"><HeartHandshake size={16} className="text-[#c9a227]" /> Contact through VANTA</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#c9a227]/20 via-transparent to-white/[0.03] blur-xl" />
              <div className="relative overflow-hidden rounded-[1.7rem] border border-white/[0.12] bg-[#111]/95 p-4 shadow-2xl sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9a227]">Find your fit</p>
                    <p className="mt-1 text-lg font-bold">Start with what matters</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-[#d7b548]"><MapPin size={20} /></span>
                </div>
                <HomeFilterBar propertyTypes={propertyTypes} rentPeriods={rentPeriods} current={params} />
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-xs text-white/45">
                  <ShieldCheck size={15} className="shrink-0 text-[#c9a227]" />
                  Never pay a deposit before verifying the property and owner.
                </div>
              </div>
            </div>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-2 sm:mt-12">
            <span className="mr-1 text-xs font-medium text-white/40">Explore by type</span>
            {quickTypes.map((type) => (
              <a key={type.value} href={`/homes?propertyType=${type.value}`} className={`rounded-full border px-3.5 py-2 text-xs font-medium transition sm:text-sm ${params.propertyType === type.value ? 'border-[#c9a227]/60 bg-[#c9a227]/15 text-[#e2c45f]' : 'border-white/[0.1] bg-white/[0.025] text-white/65 hover:border-white/25 hover:text-white'}`}>
                {type.label} <ArrowRight size={12} className="ml-1 inline" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c9a227]">The collection</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Homes worth a closer look</h2>
            <p className="mt-2 text-sm text-white/50">
              {data.data.length ? `Showing ${data.data.length} place${data.data.length === 1 ? '' : 's'} to get you started.` : 'Your next place might be one search away.'}
            </p>
          </div>
          <a href="/homes/manage" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-sm text-white/65 transition hover:border-[#c9a227]/40 hover:text-white">
            Manage listings <ArrowRight size={15} />
          </a>
        </div>

        {data.data.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] px-4 py-12 text-center sm:px-8">
            <EmptyState title="No homes found just yet" description="Try another location or remove a filter. New listings will appear here as they become available." />
            <a href="/homes" className="mt-3 inline-flex rounded-xl border border-[#c9a227]/40 px-4 py-2 text-sm font-semibold text-[#e2c45f] transition hover:bg-[#c9a227]/10">Browse all homes</a>
          </div>
        ) : (
          <HomesResults
            initialListings={data.data}
            initialCursor={data.nextCursor || null}
            initialHasMore={Boolean(data.hasMore && data.nextCursor)}
            filters={params}
            pageLimit={PAGE_LIMIT}
          />
        )}
      </section>
    </main>
  );
}
