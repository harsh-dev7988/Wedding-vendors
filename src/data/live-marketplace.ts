import "server-only";

import { INDEXABLE_SUPPLY_THRESHOLD } from "@/config/site";
import type {
  PriceUnit,
  PublicReview,
  PublicVendor,
  VendorSearch,
  VendorSearchResult,
} from "@/domain/marketplace";
import { isSupabaseConfigured } from "@/lib/env";
import { formatResponseTime } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaUrlResolver } from "@/lib/supabase/media";

const LISTING_MEDIA_LIMIT = 12;

/**
 * Public discovery reads use the cookie-free `anon` client so these routes stay
 * prerenderable. Ratings come from trigger-maintained columns on `listings`
 * rather than an unbounded embedded `reviews` select, which previously pulled
 * every review row for up to 60 listings on a single directory render.
 */
const LISTING_SELECT =
  "id, slug, title, summary, description, locality, price_from, price_unit, years_experience, rating_avg, rating_count, response_minutes, response_sample_size, service_radius_m, published_at, " +
  "vendors!inner(id, business_name, status, verified_at, verification_expires_at), " +
  // `listings` reaches `cities` twice — through primary_city_id and through
  // listing_service_areas — so PostgREST refuses a bare `cities` embed. Naming the
  // foreign key is what makes this the primary city rather than a service area.
  "cities!listings_primary_city_id_fkey!inner(name, slug), categories!inner(name, slug), " +
  "listing_media(storage_path, alt_text, sort_order)";

type LiveListingRow = {
  categories: { name: string; slug: string };
  cities: { name: string; slug: string };
  description: string;
  id: string;
  listing_media: Array<{
    alt_text: string;
    sort_order: number;
    storage_path: string;
  }>;
  locality: string | null;
  price_from: number | null;
  price_unit:
    | "per_plate"
    | "per_event"
    | "per_function"
    | "per_day"
    | "package"
    | "on_request";
  published_at: string | null;
  rating_avg: number | null;
  rating_count: number;
  response_minutes: number | null;
  response_sample_size: number;
  service_radius_m: number | null;
  slug: string;
  summary: string;
  title: string;
  vendors: {
    business_name: string;
    id: string;
    status: string;
    verification_expires_at: string | null;
    verified_at: string | null;
  };
  years_experience: number | null;
};

function priceUnitLabel(unit: LiveListingRow["price_unit"]): PriceUnit {
  return unit.replaceAll("_", " ") as PriceUnit;
}

/**
 * Verification expires after 12 months (`docs/PRODUCT_DECISIONS.md`). The badge
 * must follow the expiry, not merely the fact that verification once happened.
 */
function isCurrentlyVerified(vendor: LiveListingRow["vendors"]) {
  if (vendor.status !== "approved" || !vendor.verified_at) return false;
  if (!vendor.verification_expires_at) return false;
  return new Date(vendor.verification_expires_at).getTime() > Date.now();
}

type StorageUrlResolver = (path: string) => string;

function toPublicVendor(
  row: LiveListingRow,
  publicUrl: StorageUrlResolver,
): PublicVendor {
  const media = [...row.listing_media]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      url: publicUrl(item.storage_path),
      alt: item.alt_text,
    }));

  const cover = media[0];

  return {
    categorySlug: row.categories.slug,
    citySlug: row.cities.slug,
    description: row.description,
    image: cover?.url ?? "/images/generated/hero-celebration.webp",
    imageAlt: cover?.alt ?? `${row.title} wedding service`,
    listingId: row.id,
    locality: row.locality ?? row.cities.name,
    media,
    name: row.title,
    priceUnit: priceUnitLabel(row.price_unit),
    rating: row.rating_count > 0 ? (row.rating_avg ?? null) : null,
    responseTime: formatResponseTime(
      row.response_minutes,
      row.response_sample_size,
    ),
    reviewCount: row.rating_count,
    serviceRadiusM: row.service_radius_m,
    slug: row.slug,
    startingPrice: row.price_from,
    summary: row.summary,
    tags: [],
    vendorId: row.vendors.id,
    verified: isCurrentlyVerified(row.vendors),
    yearsInBusiness: row.years_experience ?? 0,
  };
}

type SearchRow = {
  category_name: string;
  category_slug: string;
  city_name: string;
  city_slug: string;
  cover_alt: string | null;
  cover_path: string | null;
  distance_km: number | null;
  id: string;
  locality: string | null;
  price_from: number | null;
  price_unit: LiveListingRow["price_unit"];
  rating_avg: number | null;
  rating_count: number;
  response_minutes: number | null;
  service_radius_m: number | null;
  slug: string;
  summary: string;
  title: string;
  total_count: number;
  vendor_id: string;
  verified: boolean;
  years_experience: number | null;
};

export async function searchLiveVendors(
  search: VendorSearch = {},
): Promise<VendorSearchResult> {
  if (!isSupabaseConfigured()) return { vendors: [], total: 0 };

  const supabase = createPublicClient();
  const pageSize = Math.min(search.pageSize ?? 24, 60);
  const page = Math.max(1, search.page ?? 1);

  const { data, error } = await supabase.rpc("search_listings", {
    filter_category: search.category ?? null,
    filter_city: search.city ?? null,
    filter_max_price: search.maxPrice ?? null,
    filter_min_price: search.minPrice ?? null,
    filter_min_rating: search.minRating ?? null,
    filter_pincode: search.pincode ?? null,
    filter_query: search.query ?? null,
    filter_radius_km: search.radiusKm ?? null,
    filter_verified_only: search.verifiedOnly ?? false,
    origin_lat: search.originLat ?? null,
    origin_lng: search.originLng ?? null,
    page_limit: pageSize,
    page_offset: (page - 1) * pageSize,
    sort_by: search.sort ?? "recent",
  });

  if (error || !data) return { vendors: [], total: 0 };
  const rows = data as SearchRow[];
  if (rows.length === 0) return { vendors: [], total: 0 };

  const publicUrl = mediaUrlResolver(supabase, "card");

  const vendors: PublicVendor[] = rows.map((row) => {
    const cover = row.cover_path
      ? { alt: row.cover_alt ?? row.title, url: publicUrl(row.cover_path) }
      : null;

    return {
      categorySlug: row.category_slug,
      citySlug: row.city_slug,
      description: row.summary,
      distanceKm: row.distance_km,
      image: cover?.url ?? "/images/generated/hero-celebration.webp",
      imageAlt: cover?.alt ?? `${row.title} wedding service`,
      listingId: row.id,
      locality: row.locality ?? row.city_name,
      media: cover ? [cover] : [],
      name: row.title,
      priceUnit: priceUnitLabel(row.price_unit),
      rating: row.rating_count > 0 ? row.rating_avg : null,
      responseTime: formatResponseTime(row.response_minutes, row.rating_count),
      reviewCount: row.rating_count,
      serviceRadiusM: row.service_radius_m,
      slug: row.slug,
      startingPrice: row.price_from,
      summary: row.summary,
      tags: [],
      vendorId: row.vendor_id,
      verified: row.verified,
      yearsInBusiness: row.years_experience ?? 0,
    };
  });

  return { vendors, total: Number(rows[0].total_count ?? vendors.length) };
}

export async function getLiveVendorBySlug(slug: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("vendors.status", "approved")
    .order("sort_order", {
      ascending: true,
      referencedTable: "listing_media",
    })
    .limit(LISTING_MEDIA_LIMIT, { referencedTable: "listing_media" })
    .maybeSingle();

  if (error || !data) return null;

  const publicUrl = mediaUrlResolver(supabase, "card");

  return toPublicVendor(data as unknown as LiveListingRow, publicUrl);
}

/**
 * Resolve a retired slug to the listing's current one so a renamed listing
 * keeps its inbound links instead of 404ing.
 */
export async function resolveRenamedSlug(slug: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listing_slug_history")
    .select("listings!inner(slug)")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const current = (data as unknown as { listings: { slug: string } }).listings;
  return current?.slug && current.slug !== slug ? current.slug : null;
}

type ReviewRow = {
  body: string;
  created_at: string;
  id: string;
  rating: number;
  vendor_reply: string | null;
};

export async function getPublishedReviews(
  listingId: string,
  limit = 20,
): Promise<readonly PublicReview[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, vendor_reply, created_at")
    .eq("listing_id", listingId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as ReviewRow[]).map((row) => ({
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    rating: row.rating,
    vendorReply: row.vendor_reply,
  }));
}

/** Related listings for a live profile, drawn only from other live listings. */
export async function getRelatedLiveVendors(
  vendor: PublicVendor,
  limit = 3,
): Promise<readonly PublicVendor[]> {
  if (!isSupabaseConfigured()) return [];

  const { vendors } = await searchLiveVendors({
    category: vendor.categorySlug,
    city: vendor.citySlug,
    pageSize: limit + 1,
  });

  return vendors.filter((item) => item.slug !== vendor.slug).slice(0, limit);
}

export type DirectorySupply = {
  categorySlug: string;
  citySlug: string;
  total: number;
};

/**
 * Published-listing counts per city/category, used to decide which directory
 * pages are worth submitting to search engines and which must be `noindex`.
 */
export async function getDirectorySupply(): Promise<DirectorySupply[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    // vendors has to be embedded to be filtered on: PostgREST rejects a filter
    // that names a relation the select never joined, so this whole query used
    // to fail and every supply count silently read as zero.
    .select(
      "cities!listings_primary_city_id_fkey!inner(slug), categories!inner(slug), vendors!inner(status)",
    )
    .eq("status", "published")
    .eq("vendors.status", "approved")
    .limit(10000);

  if (error || !data) return [];

  const counts = new Map<string, DirectorySupply>();
  for (const row of data as unknown as Array<{
    categories: { slug: string };
    cities: { slug: string };
  }>) {
    const key = `${row.cities.slug}/${row.categories.slug}`;
    const existing = counts.get(key);
    if (existing) {
      existing.total += 1;
    } else {
      counts.set(key, {
        categorySlug: row.categories.slug,
        citySlug: row.cities.slug,
        total: 1,
      });
    }
  }

  return [...counts.values()];
}

export async function countPublishedListings(
  citySlug: string,
  categorySlug: string,
) {
  if (!isSupabaseConfigured()) return 0;

  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("listings")
    .select(
      "id, cities!listings_primary_city_id_fkey!inner(slug), categories!inner(slug), vendors!inner(status)",
      {
        count: "exact",
        head: true,
      },
    )
    .eq("status", "published")
    .eq("vendors.status", "approved")
    .eq("cities.slug", citySlug)
    .eq("categories.slug", categorySlug);

  return error ? 0 : (count ?? 0);
}

export function isIndexableDirectory(total: number) {
  return total >= INDEXABLE_SUPPLY_THRESHOLD;
}

/** Published listing slugs plus their last update, for the sitemap. */
export async function getLiveSitemapEntries() {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    .select("slug, updated_at, vendors!inner(status)")
    .eq("status", "published")
    .eq("vendors.status", "approved")
    .order("published_at", { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  return (data as unknown as Array<{ slug: string; updated_at: string }>).map(
    ({ slug, updated_at }) => ({ slug, updatedAt: updated_at }),
  );
}

export type ListingFacets = {
  maxPrice: number | null;
  minPrice: number | null;
  ratedCount: number;
  total: number;
  verifiedCount: number;
};

/** Price and rating bounds for a city/category, so the UI never invents ranges. */
export async function getListingFacets(
  citySlug?: string,
  categorySlug?: string,
): Promise<ListingFacets> {
  const empty: ListingFacets = {
    maxPrice: null,
    minPrice: null,
    ratedCount: 0,
    total: 0,
    verifiedCount: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("listing_facets", {
    filter_category: categorySlug ?? null,
    filter_city: citySlug ?? null,
  });

  if (error || !data) return empty;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        max_price: number | null;
        min_price: number | null;
        rated_count: number;
        total: number;
        verified_count: number;
      }
    | undefined;
  if (!row) return empty;

  return {
    maxPrice: row.max_price,
    minPrice: row.min_price,
    ratedCount: Number(row.rated_count ?? 0),
    total: Number(row.total ?? 0),
    verifiedCount: Number(row.verified_count ?? 0),
  };
}

export type DirectoryParam = { category: string; city: string };

/**
 * Every city/category pair that should have a page, read from the database.
 *
 * Previously this came from a seed file, so cities lived in two places and
 * adding one in Supabase did nothing until somebody edited code and redeployed.
 * Reading it here means a row insert produces pages on the next revalidation.
 *
 * Falls back to an empty list when Supabase is unreachable at build time; the
 * caller keeps its seed list for that case, so a transient outage cannot ship a
 * build with no directory pages at all.
 */
export async function getDirectoryParams(): Promise<DirectoryParam[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const [cities, categories] = await Promise.all([
    supabase
      .from("cities")
      .select("slug")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("categories").select("slug").order("sort_order"),
  ]);

  if (cities.error || categories.error || !cities.data || !categories.data) {
    return [];
  }

  return cities.data.flatMap((city) =>
    (categories.data ?? []).map((category) => ({
      category: category.slug as string,
      city: city.slug as string,
    })),
  );
}

export type PincodeArea = {
  readonly cityName: string | null;
  readonly citySlug: string | null;
  readonly district: string | null;
  readonly known: boolean;
};

/**
 * Where a pincode is, if we know it.
 *
 * `search_listings` treats an unknown pincode as "no origin", which silently
 * turns the distance filter into a no-op — the visitor sets a radius, gets
 * unfiltered results, and is told nothing. Returning the area lets the caller
 * both explain that and, when the pincode *is* known but nothing is nearby,
 * offer the surrounding city instead of an empty page.
 */
export async function lookupPincode(
  pincode: string | undefined,
): Promise<PincodeArea> {
  const unknown: PincodeArea = {
    cityName: null,
    citySlug: null,
    district: null,
    known: false,
  };
  if (!pincode) return { ...unknown, known: true };
  if (!isSupabaseConfigured()) return { ...unknown, known: true };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("lookup_pincode", {
    requested_pincode: pincode,
  });
  const row = Array.isArray(data) ? data[0] : null;
  // A failed lookup must not masquerade as an unknown pincode — that would
  // show a misleading message during an outage.
  if (error) return { ...unknown, known: true };
  if (!row) return unknown;

  return {
    cityName: (row.city_name as string | null) ?? null,
    citySlug: (row.city_slug as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    known: true,
  };
}
