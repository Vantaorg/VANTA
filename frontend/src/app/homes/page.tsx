import { fetchHomes, fetchHomePropertyTypes, fetchHomeRentPeriods } from '@/lib/services';
import { HomeFilterBar } from '@/components/homes/HomeFilterBar';
import EmptyState from '@/components/ui/EmptyState';
import { PostHomeButton } from '@/components/homes/PostHomeButton';
import HomesResults from '@/components/homes/HomesResults';
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react';

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
    <main className="relative left-1/2 flex h-[var(--vanta-vh,100dvh)] min-h-0 w-screen max-w-none -translate-x-1/2 flex-col overflow-hidden bg-[#080808] text-white">
      <header className="relative z-50 h-14 shrink-0 border-b border-white/[.06] bg-[#080808]/90 px-4 backdrop-blur-xl">
        <div className="flex h-full w-full items-center justify-between gap-4">
          <a href="/homes" className="flex min-w-0 items-center gap-3" aria-label="VANTA Homes">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#c9a227] text-black"><Building2 size={19} /></span>
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-black tracking-[.16em] text-[#d7b548]">VANTA</span>
              <span className="text-sm font-medium text-white/80">Homes</span>
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <a href="/homes/manage" className="hidden px-3 py-2 text-sm text-white/60 transition hover:text-white sm:inline-flex">My listings</a>
            <PostHomeButton />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">


      <section className="border-b border-white/[.06]">
        <div className="w-full px-3 pb-5 pt-6 sm:px-5 sm:pb-7 sm:pt-8">
          <div className="w-full">
            <p className="text-[11px] font-semibold uppercase leading-4 tracking-[.2em] text-[#c9a227]">Find a place to call home</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:mt-5 sm:text-4xl">Homes for the way you live.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55 sm:mt-4 sm:text-base sm:leading-7">Search available rentals by location, price and property type. Compare the details and contact the owner when you find the right fit.</p>
          </div>
          <div className="mt-5 w-full">
            <HomeFilterBar propertyTypes={propertyTypes} rentPeriods={rentPeriods} current={params} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
            <ShieldCheck size={14} className="shrink-0 text-[#c9a227]" />
            Verify the property and owner before paying a deposit.
          </div>
        </div>
      </section>

      <section className="w-full px-0 pb-28 pt-5 sm:pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-3 sm:px-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{params.q || params.city || params.area ? 'Search results' : 'Recently added homes'}</h2>
            <p className="mt-1.5 text-sm text-white/45">{data.data.length ? `Showing ${data.data.length} available propert${data.data.length === 1 ? 'y' : 'ies'}.` : 'No approved listings matched this search.'}</p>
          </div>
          <a href="/homes/manage" className="inline-flex items-center gap-1.5 py-2 text-sm text-white/55 transition hover:text-[#e2c45f]">Manage listings <ArrowRight size={14} /></a>
        </div>
        {data.data.length === 0 ? (
          <div className="mx-3 rounded-2xl border border-white/[.07] bg-white/[.025] px-5 py-10 text-center sm:mx-5">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#c9a227]/[.1] text-[#e0bb4f]"><Building2 size={22}/></span>
            <h3 className="mt-4 text-base font-semibold text-white">{params.q || params.city || params.area || params.propertyType ? 'No homes match those filters' : 'No approved homes yet'}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">{params.q || params.city || params.area || params.propertyType ? 'Try a broader location, another property type, or clear your filters. Only approved and available listings appear here.' : 'New rentals appear here after the owner submits them and VANTA approves them. You can still browse VANTA or list a property.'}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(params.q || params.city || params.area || params.propertyType || params.minRent || params.maxRent || params.bedrooms || params.bathrooms || params.furnished) && <a href="/homes" className="inline-flex min-h-10 items-center rounded-lg border border-white/[.12] px-4 text-sm text-white/75 transition hover:bg-white/[.06]">Clear filters</a>}
              <a href="/homes/create" className="inline-flex min-h-10 items-center rounded-lg bg-[#c9a227] px-4 text-sm font-semibold text-black transition hover:bg-[#e0bb4f]">List a property</a>
            </div>
          </div>
        ) : (
          <HomesResults initialListings={data.data} initialCursor={data.nextCursor || null} initialHasMore={Boolean(data.hasMore && data.nextCursor)} filters={params} pageLimit={PAGE_LIMIT} />
        )}
      </section>
      </div>
    </main>
  );
}
