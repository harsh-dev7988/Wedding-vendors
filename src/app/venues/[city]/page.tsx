import type { Metadata } from "next";

import { DirectoryPage } from "@/components/marketplace/directory-page";
import {
  countPublishedListings,
  getListingFacets,
  isIndexableDirectory,
} from "@/data/live-marketplace";
import { getCities, getCityBySlug } from "@/data/cities";
import { getVenueCategory } from "@/data/categories";
import {
  directoryDescription,
  directoryTitle,
} from "@/lib/seo/structured-data";

// The indexable venue landing page for a city. Same contract as the vendor
// directory: prerendered, revalidated on demand when moderation publishes.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/venues/[city]">): Promise<Metadata> {
  const { city } = await params;
  const metro = await getCityBySlug(city);
  if (!metro) return {};

  const venues = await getVenueCategory();
  const canonical = `/venues/${metro.slug}`;
  const [supply, facets] = await Promise.all([
    countPublishedListings(metro.slug, venues.slug),
    getListingFacets(metro.slug, venues.slug),
  ]);
  const title = directoryTitle({
    categoryName: venues.name,
    cityName: metro.name,
    total: supply,
  });

  return {
    title,
    description: directoryDescription({
      categoryName: venues.name,
      cityName: metro.name,
      minPrice: facets.minPrice,
      total: supply,
    }),
    alternates: { canonical },
    // Same threshold as every other directory: below it this is thin content.
    robots: isIndexableDirectory(supply)
      ? undefined
      : { index: false, follow: true },
    openGraph: { title, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function CityVenuesPage({
  params,
}: PageProps<"/venues/[city]">) {
  const { city } = await params;

  return (
    <DirectoryPage
      categorySlug={(await getVenueCategory()).slug}
      citySlug={city}
      description={(cityName) =>
        `Banquet halls, lawns, resorts and hotels serving ${cityName}. Public profiles contain service information only; direct contact is released after a validated enquiry.`
      }
      page={1}
      section="venues"
      title={(cityName) => `Wedding venues in ${cityName}`}
    />
  );
}
