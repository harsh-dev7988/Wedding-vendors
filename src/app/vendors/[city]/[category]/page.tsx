import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { VendorDirectory } from "@/components/marketplace/vendor-directory";
import { DIRECTORY_PAGE_SIZE } from "@/config/site";
import {
  countPublishedListings,
  getDirectoryParams,
  getListingFacets,
  isIndexableDirectory,
  searchLiveVendors,
} from "@/data/live-marketplace";
import {
  getAllDirectoryParams,
  getCategoryBySlug,
  getMetroBySlug,
  searchVendors,
} from "@/data/marketplace";
import {
  breadcrumbJsonLd,
  directoryDescription,
  directoryJsonLd,
  directoryTitle,
} from "@/lib/seo/structured-data";

// Public discovery reads use the cookie-free client, so these 60 routes are
// prerendered and then refreshed on demand when moderation publishes a listing.
export const revalidate = 300;
// The valid city/category pairs are a finite, known set. Refusing unknown
// params at the routing layer returns a real 404 status: with a loading
// boundary in place, rendering one would stream a 200 shell first and only
// then discover the route does not exist, which crawlers read as a soft 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  // Database first, so a city added in Supabase produces pages without a
  // deploy. The seed list is the fallback: if the database is unreachable
  // during a build, shipping zero directory pages would be far worse than
  // shipping the last known set.
  const live = await getDirectoryParams();
  return live.length > 0 ? live : getAllDirectoryParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/vendors/[city]/[category]">): Promise<Metadata> {
  const { city, category } = await params;
  const metro = getMetroBySlug(city);
  const categoryDetails = getCategoryBySlug(category);

  if (!metro || !categoryDetails) return {};

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
  const metro = getMetroBySlug(city);
  const categoryDetails = getCategoryBySlug(category);

  if (!metro || !categoryDetails) notFound();

  const live = await searchLiveVendors({
    category: categoryDetails.slug,
    city: metro.slug,
    page: 1,
    pageSize: DIRECTORY_PAGE_SIZE,
  });

  const previewVendors = searchVendors({
    category: categoryDetails.slug,
    city: metro.slug,
  }).filter(
    (preview) => !live.vendors.some((item) => item.slug === preview.slug),
  );

  const path = `/vendors/${metro.slug}/${categoryDetails.slug}`;
  const allVendors = [...live.vendors, ...previewVendors];

  return (
    <>
      <JsonLd
        data={directoryJsonLd({
          categoryName: categoryDetails.name,
          cityName: metro.name,
          path,
          vendors: allVendors,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Vendors", path: "/vendors" },
          { name: metro.name, path: `/vendors/${metro.slug}` },
          { name: categoryDetails.name, path },
        ])}
      />
      <VendorDirectory
        basePath={`/vendors/${metro.slug}/${categoryDetails.slug}`}
        category={categoryDetails.slug}
        city={metro.slug}
        description={`Compare ${categoryDetails.name.toLocaleLowerCase("en-IN")} serving ${metro.name}. Public profiles contain service information only; direct contact is released after a validated enquiry.`}
        moreHref={
          live.total > DIRECTORY_PAGE_SIZE
            ? `/vendors?city=${metro.slug}&category=${categoryDetails.slug}`
            : undefined
        }
        page={1}
        pageSize={DIRECTORY_PAGE_SIZE}
        title={`${categoryDetails.name} in ${metro.name}`}
        total={live.total}
        vendors={allVendors}
      />
    </>
  );
}
