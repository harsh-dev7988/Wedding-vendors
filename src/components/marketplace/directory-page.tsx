import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { VendorDirectory } from "@/components/marketplace/vendor-directory";
import { DIRECTORY_PAGE_SIZE } from "@/config/site";
import { getListingFacets, searchLiveVendors } from "@/data/live-marketplace";
import { getCityBySlug } from "@/data/cities";
import { getCategoryBySlug, getCategoryMap } from "@/data/categories";
import { searchVendors } from "@/data/marketplace";
import { breadcrumbJsonLd, directoryJsonLd } from "@/lib/seo/structured-data";

/**
 * A prerendered city + category directory, for both sections and every page.
 *
 * Four routes render this: vendors and venues, each at page one and at
 * `/page/[n]`. They differ only in their URL shape, and duplicating the query,
 * the preview padding and the structured data across four files is how they
 * would quietly stop matching each other.
 *
 * Nothing here reads `searchParams`. That is the whole reason the deeper pages
 * are real routes: reading a query string opts the route into dynamic
 * rendering, and these are the pages that most need to be cached and indexed.
 */
export async function DirectoryPage({
  categorySlug,
  citySlug,
  description,
  kind,
  page,
  section,
  subtypes,
  title,
}: {
  /**
   * The subtype being shown, or undefined for the whole section.
   *
   * `/venues/mumbai` has to match every venue in Mumbai, not only listings
   * filed under the parent `venues` category — the moment a banquet hall was
   * filed under `banquet-halls` it would have disappeared from the city's own
   * venue page. So the section filters on `kind` and only a subtype page
   * filters on a category.
   */
  readonly categorySlug?: string;
  readonly citySlug: string;
  readonly description: (cityName: string) => string;
  readonly kind: "venue" | "service";
  readonly page: number;
  readonly section: "vendors" | "venues";
  /** Sibling subtypes to offer, shown on a section page. */
  readonly subtypes?: readonly { name: string; slug: string }[];
  readonly title: (cityName: string, categoryName: string) => string;
}) {
  const metro = await getCityBySlug(citySlug);
  const category = categorySlug
    ? await getCategoryBySlug(categorySlug)
    : undefined;
  if (!metro || (categorySlug && !category)) notFound();

  const venueSection = section === "venues";
  const root = venueSection ? "/venues" : "/vendors";
  const canonical = venueSection
    ? category
      ? `/venues/${metro.slug}/${category.slug}`
      : `/venues/${metro.slug}`
    : `/vendors/${metro.slug}/${category?.slug}`;

  const [live, facets] = await Promise.all([
    searchLiveVendors({
      category: category?.slug,
      city: metro.slug,
      kind,
      page,
      pageSize: DIRECTORY_PAGE_SIZE,
    }),
    // Request-cached, so this is the same round trip generateMetadata made.
    getListingFacets(metro.slug, category?.slug),
  ]);

  // Beyond the last real page there is nothing to show, and rendering an empty
  // directory at a 200 is a soft 404. Page one is exempt: an empty first page
  // is a legitimate "no supply here yet".
  const lastPage = Math.max(1, Math.ceil(live.total / DIRECTORY_PAGE_SIZE));
  if (page > 1 && page > lastPage) notFound();

  // Fixtures pad the first page only, and are never counted as real supply.
  const categories = await getCategoryMap();
  const previewVendors =
    page === 1
      ? searchVendors({ category: category?.slug, city: metro.slug }).filter(
          (preview) =>
            !live.vendors.some((item) => item.slug === preview.slug) &&
            // Without a category to filter on, the section's kind is what keeps
            // a photographer fixture off the venue page.
            categories.get(preview.categorySlug)?.kind === kind,
        )
      : [];

  const allVendors = [...live.vendors, ...previewVendors];

  return (
    <>
      <JsonLd
        data={directoryJsonLd({
          categoryName: category?.name ?? "Venues",
          cityName: metro.name,
          path: canonical,
          vendors: allVendors,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd(
          venueSection
            ? category
              ? [
                  { name: "Venues", path: "/venues" },
                  { name: metro.name, path: `/venues/${metro.slug}` },
                  { name: category.name, path: canonical },
                ]
              : [
                  { name: "Venues", path: "/venues" },
                  { name: metro.name, path: canonical },
                ]
            : [
                { name: "Vendors", path: "/vendors" },
                { name: metro.name, path: `/vendors/${metro.slug}` },
                { name: category?.name ?? "", path: canonical },
              ],
        )}
      />
      <VendorDirectory
        // The city and category are this page's identity, not filters — the
        // panel has no controls for them and carries them as hidden fields, so
        // refining never navigates away from the pair the visitor chose.
        activeFilters={{
          category: venueSection ? undefined : category?.slug,
          city: metro.slug,
        }}
        basePath={canonical}
        category={category?.slug}
        city={metro.slug}
        description={description(metro.name)}
        facets={facets}
        filterBasePath={root}
        hideCategoryControl={venueSection}
        page={page}
        pageHref={(target) =>
          target === 1 ? canonical : `${canonical}/page/${target}`
        }
        pageSize={DIRECTORY_PAGE_SIZE}
        subtypes={subtypes}
        subtypeBasePath={`/venues/${metro.slug}`}
        title={title(metro.name, category?.name ?? "Venues")}
        total={live.total}
        vendors={allVendors}
      />
    </>
  );
}

/** Every page beyond the first, for a directory that has real supply. */
export async function directoryPageParams(
  totalFor: () => Promise<number>,
): Promise<string[]> {
  const total = await totalFor();
  const lastPage = Math.ceil(total / DIRECTORY_PAGE_SIZE);
  if (lastPage < 2) return [];
  return Array.from({ length: lastPage - 1 }, (_, index) => String(index + 2));
}
