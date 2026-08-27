import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  DirectoryPage,
  directoryPageParams,
} from "@/components/marketplace/directory-page";
import { countPublishedListings } from "@/data/live-marketplace";
import { getCities, getCityBySlug } from "@/data/cities";
import { getVenueCategory } from "@/data/marketplace";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cities = await getCities();
  const venues = getVenueCategory();
  const params: Array<{ city: string; n: string }> = [];

  for (const city of cities) {
    const pages = await directoryPageParams(() =>
      countPublishedListings(city.slug, venues.slug),
    );
    for (const n of pages) params.push({ city: city.slug, n });
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
}: PageProps<"/venues/[city]/page/[n]">): Promise<Metadata> {
  const { city, n } = await params;
  const page = parsePageSegment(n);
  const metro = await getCityBySlug(city);
  if (!page || !metro) return {};

  return {
    title: `Wedding venues in ${metro.name} — page ${page}`,
    alternates: { canonical: `/venues/${metro.slug}/page/${page}` },
    // Navigation, not a landing page: crawlable so the venues on it are found,
    // but not competing with page one in results.
    robots: { index: false, follow: true },
  };
}

export default async function CityVenuesPagedPage({
  params,
}: PageProps<"/venues/[city]/page/[n]">) {
  const { city, n } = await params;
  const page = parsePageSegment(n);
  if (!page) notFound();
  // Page one lives at the canonical URL; two URLs for it would be duplicates.
  if (page === 1) permanentRedirect(`/venues/${city}`);

  return (
    <DirectoryPage
      categorySlug={getVenueCategory().slug}
      citySlug={city}
      description={(cityName) =>
        `Banquet halls, lawns, resorts and hotels serving ${cityName}. Public profiles contain service information only; direct contact is released after a validated enquiry.`
      }
      page={page}
      section="venues"
      title={(cityName) => `Wedding venues in ${cityName}`}
    />
  );
}
