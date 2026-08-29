import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  DirectoryPage,
  directoryPageParams,
} from "@/components/marketplace/directory-page";
import {
  countPublishedListings,
  getDirectoryParams,
} from "@/data/live-marketplace";
import { getCityBySlug } from "@/data/cities";
import { getCategoryBySlug, getCategoryMap } from "@/data/categories";

export const revalidate = 300;
export const dynamicParams = true;

/**
 * Page two onward as real routes.
 *
 * The directory used to render the first 24 and hand everything beyond them to
 * `/vendors`, which is `noindex` — so a crawler following the only available
 * link was told to ignore where it landed, and the listings past the first page
 * had no indexable home at all. A path keeps them prerendered and crawlable;
 * a `?page=` parameter could not, because reading it makes the route dynamic.
 */
export async function generateStaticParams() {
  // `getDirectoryParams` already excludes venues, but this route is also the
  // one that redirects them, so resolving the map keeps the two in agreement
  // without a query per pair.
  const [pairs, categories] = await Promise.all([
    getDirectoryParams(),
    getCategoryMap(),
  ]);
  const params: Array<{ category: string; city: string; n: string }> = [];

  for (const pair of pairs) {
    if (categories.get(pair.category)?.kind === "venue") continue;
    const pages = await directoryPageParams(() =>
      countPublishedListings(pair.city, pair.category),
    );
    for (const n of pages) {
      params.push({ category: pair.category, city: pair.city, n });
    }
  }

  return params;
}

function parsePageSegment(value: string) {
  // Only a plain integer. "01" and "2e3" would be different URLs for the same
  // page, which is duplicate content for anything that crawls them.
  if (!/^[1-9][0-9]{0,3}$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

export async function generateMetadata({
  params,
}: PageProps<"/vendors/[city]/[category]/page/[n]">): Promise<Metadata> {
  const { city, category, n } = await params;
  const page = parsePageSegment(n);
  const metro = await getCityBySlug(city);
  const categoryDetails = await getCategoryBySlug(category);
  if (!page || !metro || !categoryDetails) return {};

  const canonical = `/vendors/${metro.slug}/${categoryDetails.slug}/page/${page}`;
  return {
    title: `${categoryDetails.name} in ${metro.name} — page ${page}`,
    alternates: { canonical },
    // Page two onward is navigation, not a landing page: crawlable so the
    // listings on it are found, but not competing with page one in results.
    robots: { index: false, follow: true },
  };
}

export default async function CityCategoryPagedPage({
  params,
}: PageProps<"/vendors/[city]/[category]/page/[n]">) {
  const { city, category, n } = await params;
  const page = parsePageSegment(n);
  if (!page) notFound();
  // Page one lives at the canonical URL; two URLs for it would be duplicates.
  if (page === 1) permanentRedirect(`/vendors/${city}/${category}`);
  // Same as page one: an unknown city answers 404 rather than redirecting to
  // one, so a URL that never existed is never reported as having moved.
  const details = await getCategoryBySlug(category);
  if (details?.kind === "venue") {
    if (!(await getCityBySlug(city))) notFound();
    permanentRedirect(`/venues/${city}/page/${page}`);
  }

  return (
    <DirectoryPage
      categorySlug={category}
      citySlug={city}
      description={(cityName) =>
        `Compare ${(details?.name ?? "vendors").toLocaleLowerCase("en-IN")} serving ${cityName}. Public profiles contain service information only; direct contact is released after a validated enquiry.`
      }
      page={page}
      section="vendors"
      title={(cityName, categoryName) => `${categoryName} in ${cityName}`}
    />
  );
}
