import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { DirectoryPage } from "@/components/marketplace/directory-page";
import {
  countPublishedListings,
  getDirectoryParams,
  getListingFacets,
  isIndexableDirectory,
} from "@/data/live-marketplace";
import { getCityBySlug } from "@/data/cities";
import { getCategoryBySlug, SUPERSEDED_CATEGORIES } from "@/data/categories";
import { getAllDirectoryParams } from "@/data/marketplace";
import {
  directoryDescription,
  directoryTitle,
} from "@/lib/seo/structured-data";

// Public discovery reads use the cookie-free client, so these routes are
// prerendered and then refreshed on demand when moderation publishes a listing.
export const revalidate = 300;
// A city added in Supabase becomes reachable immediately rather than waiting
// for a deploy. Unknown pairs still 404: the page resolves the slug against the
// database and calls notFound().
//
// No loading boundary may sit beside this file. One streams a 200 shell before
// the page can discover the route is invalid, which turns a real 404 into a
// soft one.
export const dynamicParams = true;

export async function generateStaticParams() {
  // Database first, so a city added in Supabase produces pages without a
  // deploy. The seed list is the fallback: if the database is unreachable
  // during a build, shipping zero directory pages would be far worse than
  // shipping the last known set. Both exclude venues, which have their own
  // section at /venues/[city].
  const live = await getDirectoryParams();
  return live.length > 0 ? live : getAllDirectoryParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/vendors/[city]/[category]">): Promise<Metadata> {
  const { city, category } = await params;
  const metro = await getCityBySlug(city);
  const categoryDetails = await getCategoryBySlug(category);

  if (!metro || !categoryDetails || categoryDetails.kind === "venue") return {};

  const canonical = `/vendors/${metro.slug}/${categoryDetails.slug}`;
  const [supply, facets] = await Promise.all([
    countPublishedListings(metro.slug, categoryDetails.slug),
    getListingFacets(metro.slug, categoryDetails.slug),
  ]);
  const title = directoryTitle({
    categoryName: categoryDetails.name,
    cityName: metro.name,
    total: supply,
  });

  return {
    title,
    description: directoryDescription({
      categoryName: categoryDetails.name,
      cityName: metro.name,
      minPrice: facets.minPrice,
      total: supply,
    }),
    alternates: { canonical },
    // docs/PRODUCT_DECISIONS.md: a directory is not an SEO landing page until
    // it has real supply. Below the threshold it is thin content.
    robots: isIndexableDirectory(supply)
      ? undefined
      : { index: false, follow: true },
    openGraph: { title, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function CityCategoryPage({
  params,
}: PageProps<"/vendors/[city]/[category]">) {
  const { city, category } = await params;

  // Venues are their own section now. These URLs were indexable, so a real one
  // redirects rather than 404s, and permanently (308) rather than temporarily:
  // a 307 tells a crawler to keep the old URL in the index and check back,
  // which is the opposite of what a completed move should say.
  //
  // The city is resolved first so a URL that never existed still answers with a
  // real 404 instead of a redirect to one. A 307 pointing at a 404 tells a
  // crawler the page moved, which is worse than saying it was never there.
  const details = await getCategoryBySlug(category);
  if (details?.kind === "venue") {
    if (!(await getCityBySlug(city))) notFound();
    permanentRedirect(`/venues/${city}`);
  }

  // A category that was split into others keeps its indexed URLs alive.
  const successor = SUPERSEDED_CATEGORIES[category];
  if (successor) {
    if (!(await getCityBySlug(city))) notFound();
    permanentRedirect(`/vendors/${city}/${successor}`);
  }

  return (
    <DirectoryPage
      categorySlug={category}
      citySlug={city}
      description={(cityName) =>
        `Compare ${(details?.name ?? "vendors").toLocaleLowerCase("en-IN")} serving ${cityName}. Public profiles contain service information only; direct contact is released after a validated enquiry.`
      }
      page={1}
      section="vendors"
      title={(cityName, categoryName) => `${categoryName} in ${cityName}`}
    />
  );
}
