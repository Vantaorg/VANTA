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
    <main className="min-h-[var(--vanta-vh,100dvh)] bg-[#080808] pt-14 text-white">
      <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-white/[.06] bg-[#080808]/90 px-4 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4">
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

      <section className="border-b border-white/[.06]">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-7 sm:px-6 sm:pb-8 sm:pt-9">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#c9a227]">Find a place to call home</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Homes for the way you live.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">Search available rentals by location, price and property type. Compare the details and contact the owner when you find the right fit.</p>
          </div>
          <div className="mt-6 w-full max-w-6xl">
            <HomeFilterBar propertyTypes={propertyTypes} rentPeriods={rentPeriods} current={params} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
            <ShieldCheck size={14} className="shrink-0 text-[#c9a227]" />
            Verify the property and owner before paying a deposit.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{params.q || params.city || params.area ? 'Search results' : 'Recently added homes'}</h2>
            <p className="mt-1.5 text-sm text-white/45">{data.data.length ? `Showing ${data.data.length} available propert${data.data.length === 1 ? 'y' : 'ies'}.` : 'Listings appear here after they pass VANTA review.'}</p>
          </div>
          <a href="/homes/manage" className="inline-flex items-center gap-1.5 py-2 text-sm text-white/55 transition hover:text-[#e2c45f]">
            Manage listings <ArrowRight size={14} />
          </a>
        </div>

        {data.data.length === 0 ? (
          <div className="py-12 text-center">
            <EmptyState title="No homes found" description="Try a different location or adjust your filters. Approved listings will appear here." />
            <a href="/homes" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#e2c45f] transition hover:text-white">Clear search <ArrowRight size={14} /></a>
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
