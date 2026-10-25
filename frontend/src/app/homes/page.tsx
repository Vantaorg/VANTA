import { fetchHomes, fetchHomePropertyTypes, fetchHomeRentPeriods } from '@/lib/services';
import { HomeFilterBar } from '@/components/homes/HomeFilterBar';
import EmptyState from '@/components/ui/EmptyState';
import { PostHomeButton } from '@/components/homes/PostHomeButton';
import HomesResults from '@/components/homes/HomesResults';

const PAGE_LIMIT = 20;

export const metadata = {
  title: 'VANTA Homes — Rentals',
  description: 'Discover homes and apartments available for rent on VANTA.',
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
  if (!params.limit) params.limit = String(PAGE_LIMIT);

  let propertyTypes: string[] = [];
  let rentPeriods: string[] = [];
  try { propertyTypes = (await fetchHomePropertyTypes())?.propertyTypes || []; } catch {}
  try { rentPeriods = (await fetchHomeRentPeriods())?.rentPeriods || []; } catch {}

  let data: any = { data: [], nextCursor: null, hasMore: false };
  try {
    const res = await fetchHomes(params);
    data = res || data;
  } catch { data = { data: [], nextCursor: null, hasMore: false }; }

  return (
    <div className="min-h-[var(--vanta-vh,100dvh)] bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080808]/95 px-4 pt-4 pb-4 shadow-lg backdrop-blur-xl">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#c9a227]">VANTA Homes</span>
              <h1 className="mt-1 text-xl font-bold leading-tight text-white sm:text-2xl">Find your next home</h1>
            </div>
            <PostHomeButton />
          </div>
          <p className="mt-2 mb-4 text-sm text-white/55">Browse rentals from landlords and property owners.</p>
          <HomeFilterBar propertyTypes={propertyTypes} rentPeriods={rentPeriods} current={params} />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-28">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Available properties</h2>
            <p className="mt-1 text-xs text-white/45">{data.data.length ? 'Explore homes that match your search.' : 'No properties match these filters yet.'}</p>
          </div>
        </div>
        {data.data.length === 0 ? (
          <EmptyState title="No homes found" description="Try adjusting your filters or search for a different location." />
        ) : (
          <HomesResults
            initialListings={data.data}
            initialCursor={data.nextCursor || null}
            initialHasMore={Boolean(data.hasMore && data.nextCursor)}
            filters={params}
            pageLimit={PAGE_LIMIT}
          />
        )}
      </div>
    </div>
  );
}