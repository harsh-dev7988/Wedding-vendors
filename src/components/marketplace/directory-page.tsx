import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { RememberCity } from "@/components/location/remember-city";
import { VendorDirectory } from "@/components/marketplace/vendor-directory";
import { DIRECTORY_PAGE_SIZE } from "@/config/site";
import {
  getDirectorySupply,
  getListingFacets,
  searchLiveVendors,
} from "@/data/live-marketplace";
import { getCities, getCityBySlug } from "@/data/cities";
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
type Suggestion = { href: string; name: string; total: number };

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

  // Where this category *does* exist, for a directory that is empty. Only
  // computed when there is nothing to show, so a busy page pays nothing.
  const cityNames = new Map(
    (await getCities()).map((city) => [city.slug, city.name]),
  );
  const elsewhere =
    allVendors.length === 0 ? await suggestCities() : ([] as Suggestion[]);

  /**
   * Cities that do have what this page is showing.
   *
   * A subtype page asks about its own category. A *section* page has no
   * category to ask about — `/venues/pune` covers ten of them — so it asks
   * about the kind instead and totals a city across all of them. Without that
   * split the suggestion would only ever appear on subtype pages, which is the
   * half of the site least likely to be someone's first stop.
   */
  async function suggestCities(): Promise<Suggestion[]> {
    // Captured because `notFound()` narrowing does not reach into a closure.
    const citySlug = metro!.slug;
    const [supply, categories] = await Promise.all([
      getDirectorySupply(),
      getCategoryMap(),
    ]);

    const totals = new Map<string, number>();
    for (const row of supply) {
      if (row.citySlug === citySlug || row.total <= 0) continue;
      if (category) {
        if (row.categorySlug !== category.slug) continue;
      } else if (categories.get(row.categorySlug)?.kind !== kind) {
        continue;
      }
      totals.set(row.citySlug, (totals.get(row.citySlug) ?? 0) + row.total);
    }

    return [...totals]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([slug, total]) => ({
        href: venueSection
          ? category
            ? `/venues/${slug}/${category.slug}`
            : `/venues/${slug}`
          : `/vendors/${slug}/${category?.slug}`,
        name: cityNames.get(slug) ?? slug,
        total,
      }));
  }

  return (
    <>
      {/* Learned from the page being viewed, not asked for. */}
      <RememberCity slug={metro.slug} />
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
        elsewhere={elsewhere}
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
