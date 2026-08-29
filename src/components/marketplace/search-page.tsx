import { VendorDirectory } from "@/components/marketplace/vendor-directory";
import { DIRECTORY_PAGE_SIZE } from "@/config/site";
import {
  getListingFacets,
  lookupPincode,
  searchLiveVendors,
} from "@/data/live-marketplace";
import { getCityBySlug } from "@/data/cities";
import { getCategoryMap } from "@/data/categories";
import { searchVendors } from "@/data/marketplace";
import { parsePage } from "@/lib/pagination";

/**
 * The filtered search surface, shared by `/vendors` and `/venues`.
 *
 * The two are different products — you book one venue and it fixes the date,
 * the guest count and half the budget, while services are chosen around it —
 * but the query, the clamping and the three-way pincode explanation are
 * identical. Keeping one implementation means a fix to any of that cannot
 * apply to only one of them, which is how the two would drift apart.
 */

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** A coordinate, or undefined for anything out of range or unparseable. */
function parseCoordinate(value: string | undefined, bound: number) {
  const parsed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed) || Math.abs(parsed) > bound) return undefined;
  return parsed;
}

/** Every numeric filter is clamped, so a hand-edited URL cannot skew a query. */
function parseNumber(value: string | undefined, max: number) {
  const parsed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.min(parsed, max);
}

const SORTS = new Set([
  "recent",
  "price_asc",
  "price_desc",
  "rating",
  "experience",
  "response",
  "distance",
]);

type SearchPageProps = {
  readonly basePath: string;
  readonly description: string;
  readonly kind: "venue" | "service";
  /** Fixed for a single-category section, so the URL never carries one. */
  readonly lockedCategory?: string;
  readonly raw: Record<string, string | string[] | undefined>;
  readonly subjectFallback: string;
};

export async function SearchPage({
  basePath,
  description,
  kind,
  lockedCategory,
  raw,
  subjectFallback,
}: SearchPageProps) {
  const requestedCity = first(raw.city);
  const requestedCategory = lockedCategory ?? first(raw.category);
  const query = first(raw.q)?.slice(0, 80);
  const page = parsePage(raw.page);
  // Sent by the "use my location" control. Clamped, and only honoured as a
  // pair — a lone latitude is meaningless.
  const originLat = parseCoordinate(first(raw.lat), 90);
  const originLng = parseCoordinate(first(raw.lng), 180);
  const hasOrigin = originLat !== undefined && originLng !== undefined;
  const minPrice = parseNumber(first(raw.minPrice), 100000000);
  const maxPrice = parseNumber(first(raw.maxPrice), 100000000);
  const minRating = parseNumber(first(raw.minRating), 5);
  const rawPincode = first(raw.pincode);
  const pincode =
    rawPincode && /^[1-9][0-9]{5}$/.test(rawPincode) ? rawPincode : undefined;
  const radiusKm =
    pincode || hasOrigin ? parseNumber(first(raw.radiusKm), 200) : undefined;
  const verifiedOnly = first(raw.verifiedOnly) === "1";
  const rawSort = first(raw.sort);
  const sort = rawSort && SORTS.has(rawSort) ? (rawSort as never) : undefined;

  // Resolved against the database, not a hardcoded list. An unknown slug used
  // to make getMetroBySlug return undefined, which silently dropped the city
  // filter and returned every city instead of none.
  const metro = await getCityBySlug(requestedCity);
  // Resolved once and looked up synchronously below: the preview filter runs
  // per item and cannot await.
  const categories = await getCategoryMap();
  const requested = requestedCategory
    ? categories.get(requestedCategory)
    : undefined;
  // A category of the wrong kind is not this section's to show. Ignoring it
  // rather than honouring it keeps /venues from rendering photographers.
  const category = requested?.kind === kind ? requested : undefined;
  const city = metro?.slug;
  const categorySlug = category?.slug;

  const [live, facets, pincodeArea] = await Promise.all([
    searchLiveVendors({
      category: categorySlug,
      city,
      kind,
      maxPrice,
      minPrice,
      minRating,
      page,
      pageSize: DIRECTORY_PAGE_SIZE,
      originLat: hasOrigin ? originLat : undefined,
      originLng: hasOrigin ? originLng : undefined,
      pincode,
      query,
      radiusKm,
      sort,
      verifiedOnly,
    }),
    getListingFacets(city, categorySlug),
    lookupPincode(pincode),
  ]);
  const filtersApplied = Boolean(
    minPrice || maxPrice || minRating || pincode || verifiedOnly,
  );

  // Preview fixtures only pad out the first page, and only while real supply is
  // thin. They are never counted as if they were available inventory.
  const previewVendors =
    page === 1 && !filtersApplied && !hasOrigin
      ? searchVendors({ category: categorySlug, city, query }).filter(
          (preview) =>
            !live.vendors.some((item) => item.slug === preview.slug) &&
            // The seed fixtures predate the split, so filter them by kind too.
            categories.get(preview.categorySlug)?.kind === kind,
        )
      : [];

  // Three distinct outcomes, and an empty page explains none of them: the
  // pincode is not in the dataset, or it is but nothing serves it, or all is
  // well.
  const pincodeNotice = !pincodeArea.known
    ? `We do not have coordinates for pincode ${pincode} yet, so the distance filter was not applied. Try “Use my location” instead.`
    : pincode && live.total === 0 && pincodeArea.citySlug
      ? `No listings reach ${pincodeArea.district ?? pincode} yet.`
      : undefined;

  const vendors = [...live.vendors, ...previewVendors];
  const subject = lockedCategory
    ? subjectFallback
    : (category?.name ?? subjectFallback);
  const location = metro ? ` in ${metro.name}` : " across India";
  const cityHubBase = kind === "venue" ? "/venues" : "/vendors";

  return (
    <VendorDirectory
      basePath={basePath}
      category={categorySlug}
      city={city}
      description={description}
      hideCategoryControl={Boolean(lockedCategory)}
      page={page}
      pageSize={DIRECTORY_PAGE_SIZE}
      query={query}
      activeFilters={{
        category: lockedCategory ? undefined : categorySlug,
        city,
        maxPrice,
        minPrice,
        minRating,
        originLat: hasOrigin ? originLat : undefined,
        originLng: hasOrigin ? originLng : undefined,
        pincode,
        q: query,
        radiusKm,
        sort,
        verifiedOnly,
      }}
      facets={facets}
      notice={pincodeNotice}
      noticeAction={
        pincodeArea.known && pincode && live.total === 0 && pincodeArea.citySlug
          ? {
              href: `${cityHubBase}/${pincodeArea.citySlug}`,
              label: `See everything in ${pincodeArea.cityName}`,
            }
          : undefined
      }
      title={`${subject}${location}`}
      total={live.total}
      vendors={vendors}
    />
  );
}
