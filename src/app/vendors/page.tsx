import type { Metadata } from "next";

import { VendorDirectory } from "@/components/marketplace/vendor-directory";
import { DIRECTORY_PAGE_SIZE } from "@/config/site";
import { getListingFacets, searchLiveVendors } from "@/data/live-marketplace";
import {
  getCategoryBySlug,
  getMetroBySlug,
  searchVendors,
} from "@/data/marketplace";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Wedding vendors across India",
  description:
    "Browse wedding venues, photographers, makeup artists, planners, decorators, and caterers across major Indian metros.",
  // A free-text search surface generates unbounded URLs. The indexable
  // landing pages are /vendors/[city]/[category].
  robots: { index: false, follow: true },
  alternates: { canonical: "/vendors" },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function VendorsPage({
  searchParams,
}: PageProps<"/vendors">) {
  const raw = await searchParams;
  const requestedCity = first(raw.city);
  const requestedCategory = first(raw.category);
  const query = first(raw.q)?.slice(0, 80);
  const page = parsePage(raw.page);
  const minPrice = parseNumber(first(raw.minPrice), 100000000);
  const maxPrice = parseNumber(first(raw.maxPrice), 100000000);
  const minRating = parseNumber(first(raw.minRating), 5);
  const rawPincode = first(raw.pincode);
  const pincode =
    rawPincode && /^[1-9][0-9]{5}$/.test(rawPincode) ? rawPincode : undefined;
  const radiusKm = pincode ? parseNumber(first(raw.radiusKm), 200) : undefined;
  const verifiedOnly = first(raw.verifiedOnly) === "1";
  const rawSort = first(raw.sort);
  const sort = rawSort && SORTS.has(rawSort) ? (rawSort as never) : undefined;

  const metro = requestedCity ? getMetroBySlug(requestedCity) : undefined;
  const category = requestedCategory
    ? getCategoryBySlug(requestedCategory)
    : undefined;
  const city = metro?.slug;
  const categorySlug = category?.slug;

  const [live, facets] = await Promise.all([
    searchLiveVendors({
      category: categorySlug,
      city,
      maxPrice,
      minPrice,
      minRating,
      page,
      pageSize: DIRECTORY_PAGE_SIZE,
      pincode,
      query,
      radiusKm,
      sort,
      verifiedOnly,
    }),
    getListingFacets(city, categorySlug),
  ]);
  const filtersApplied = Boolean(
    minPrice || maxPrice || minRating || pincode || verifiedOnly,
  );

  // Preview fixtures only pad out the first page, and only while real supply is
  // thin. They are never counted as if they were available inventory.
  const previewVendors =
    page === 1 && !filtersApplied
      ? searchVendors({ category: categorySlug, city, query }).filter(
          (preview) => !live.vendors.some((item) => item.slug === preview.slug),
        )
      : [];

  const vendors = [...live.vendors, ...previewVendors];
  const subject = category?.name ?? "Wedding vendors";
  const location = metro ? ` in ${metro.name}` : " across India";

  return (
    <VendorDirectory
      basePath="/vendors"
      category={categorySlug}
      city={city}
      description="Browse category-aware profiles and starting prices. Contact details stay private until a signed-in customer submits a valid enquiry."
      page={page}
      pageSize={DIRECTORY_PAGE_SIZE}
      query={query}
      activeFilters={{
        category: categorySlug,
        city,
        maxPrice,
        minPrice,
        minRating,
        pincode,
        q: query,
        radiusKm,
        sort,
        verifiedOnly,
      }}
      facets={facets}
      title={`${subject}${location}`}
      total={live.total}
      vendors={vendors}
    />
  );
}
