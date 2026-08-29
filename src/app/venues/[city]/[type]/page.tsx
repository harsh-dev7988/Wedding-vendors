import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DirectoryPage } from "@/components/marketplace/directory-page";
import {
  countPublishedListings,
  getListingFacets,
  isIndexableDirectory,
} from "@/data/live-marketplace";
import { getCities, getCityBySlug } from "@/data/cities";
import { getCategoryBySlug, getVenueCategories } from "@/data/categories";
import {
  directoryDescription,
  directoryTitle,
} from "@/lib/seo/structured-data";

/**
 * A venue subtype in a city — banquet halls in Mumbai, farmhouses in Delhi.
 *
 * These are real searches, and quite different intents: somebody looking for a
 * kalyana mandapam is not weighing it against a farmhouse. That is why the nine
 * subtypes are routes rather than a filter on `/venues/[city]` — a filter has
 * no URL to rank, no title of its own, and nothing to link to.
 */
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const [cities, venues] = await Promise.all([
    getCities(),
    getVenueCategories(),
  ]);
  // The parent is the section itself and already lives at /venues/[city].
  const subtypes = venues.filter((category) => category.parentSlug !== null);

  return cities.flatMap((city) =>
    subtypes.map((subtype) => ({ city: city.slug, type: subtype.slug })),
  );
}

async function resolve(city: string, type: string) {
  const [metro, category] = await Promise.all([
    getCityBySlug(city),
    getCategoryBySlug(type),
  ]);
  // A service category here would render photographers under /venues.
  if (!metro || !category || category.kind !== "venue") return null;
  // The parent belongs at /venues/[city]; two URLs for it would be duplicates.
  if (category.parentSlug === null) return null;
  return { category, metro };
}

export async function generateMetadata({
  params,
}: PageProps<"/venues/[city]/[type]">): Promise<Metadata> {
  const { city, type } = await params;
  const resolved = await resolve(city, type);
  if (!resolved) return {};
  const { category, metro } = resolved;

  const canonical = `/venues/${metro.slug}/${category.slug}`;
  const [supply, facets] = await Promise.all([
    countPublishedListings(metro.slug, category.slug),
    getListingFacets(metro.slug, category.slug),
  ]);
  const title = directoryTitle({
    categoryName: category.name,
    cityName: metro.name,
    total: supply,
  });

  return {
    title,
    description: directoryDescription({
      categoryName: category.name,
      cityName: metro.name,
      minPrice: facets.minPrice,
      total: supply,
    }),
    alternates: { canonical },
    robots: isIndexableDirectory(supply)
      ? undefined
      : { index: false, follow: true },
    openGraph: { title, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function CityVenueTypePage({
  params,
}: PageProps<"/venues/[city]/[type]">) {
  const { city, type } = await params;
  const resolved = await resolve(city, type);
  if (!resolved) notFound();

  return (
    <DirectoryPage
      categorySlug={type}
      citySlug={city}
      description={(cityName) =>
        `${resolved.category.description} Serving ${cityName}. Public profiles contain service information only; direct contact is released after a validated enquiry.`
      }
      kind="venue"
      page={1}
      section="venues"
      title={(cityName, categoryName) => `${categoryName} in ${cityName}`}
    />
  );
}
