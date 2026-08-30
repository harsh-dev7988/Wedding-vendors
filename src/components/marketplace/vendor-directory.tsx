import Link from "next/link";
import { ArrowRight, Info, MapPin } from "lucide-react";

import { Pagination } from "@/components/ui/pagination";
import type { ListingFacets } from "@/data/live-marketplace";
import { isPreviewVendor, type PublicVendor } from "@/domain/marketplace";

import { DirectorySearch } from "./directory-search";
import type { ActiveFilters } from "@/lib/filters";

import { FilterPanel } from "./filter-panel";
import { VendorCard } from "./vendor-card";

type VendorDirectoryProps = {
  /** Shown above the results when a filter could not be honoured. */
  readonly notice?: string;
  /** An escape route offered alongside the notice, when one exists. */
  readonly noticeAction?: { readonly href: string; readonly label: string };
  readonly title: string;
  readonly description: string;
  readonly vendors: readonly PublicVendor[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly basePath: string;
  /**
   * Where refining a filter should land, when that is not this page.
   *
   * A `/vendors/[city]/[category]` page is prerendered, and reading
   * `searchParams` there would opt all sixty of them into dynamic rendering.
   * So the panel is rendered on the directory page — that is where people
   * actually arrive — but submitting it navigates to the dynamic search route,
   * which carries the city and category through as hidden fields. The
   * unfiltered directory stays the cacheable, canonical, indexable page and a
   * refined view is correctly a `noindex` one.
   */
  readonly filterBasePath?: string;
  /** A single-category section has no category to choose. */
  readonly hideCategoryControl?: boolean;
  /** Path-based paging, for prerendered directories. */
  readonly pageHref?: (page: number) => string;
  /**
   * Cities that do have this category, for when this one does not.
   *
   * "Nothing here" is a dead end. "Nothing here, but there are eleven in
   * Mumbai" is a route forward, and it is the difference between a directory
   * that looks abandoned and one that is honest about where it has reached.
   */
  readonly elsewhere?: readonly { href: string; name: string; total: number }[];
  /**
   * Sibling subtypes offered above the results.
   *
   * A venue section is one page covering nine kinds of place, and "banquet
   * halls in Mumbai" is what somebody actually searches for. These are how they
   * get from the section to the one they mean.
   */
  readonly subtypes?: readonly { name: string; slug: string }[];
  readonly subtypeBasePath?: string;
  /** Set when a static landing page defers deeper pages to the search route. */
  readonly moreHref?: string;
  readonly city?: string;
  readonly category?: string;
  readonly query?: string;
  readonly facets?: ListingFacets;
  readonly activeFilters?: ActiveFilters;
};

export function VendorDirectory({
  notice,
  noticeAction,
  title,
  description,
  vendors,
  total,
  page,
  pageSize,
  basePath,
  filterBasePath,
  elsewhere,
  hideCategoryControl,
  pageHref,
  subtypes,
  subtypeBasePath,
  moreHref,
  city,
  category,
  query,
  facets,
  activeFilters,
}: VendorDirectoryProps) {
  const previewCount = vendors.filter(isPreviewVendor).length;
  // `total` counts live supply only, which drives pagination. The headline
  // must count what is actually on the page, or it reads "0 listings" above a
  // grid of eleven cards.
  const displayTotal = total + previewCount;
  // City and category are the page's identity, not filters — narrowing to
  // "venues in Mumbai" is not filtering, choosing a price band is.
  const filtered = Boolean(
    activeFilters &&
    (activeFilters.minPrice ||
      activeFilters.maxPrice ||
      activeFilters.minRating ||
      activeFilters.verifiedOnly ||
      activeFilters.pincode ||
      activeFilters.q ||
      activeFilters.radiusKm),
  );

  return (
    <main id="main-content">
      <section className="border-border bg-muted/60 border-b">
        <div className="section-content mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-brand-text eyebrow">
            {hideCategoryControl
              ? "Wedding venues across India"
              : "Wedding professionals across India"}
          </p>
          <h1 className="type-page mt-3 max-w-4xl">{title}</h1>
          <p className="text-muted-foreground mt-4 max-w-3xl leading-7">
            {description}
          </p>
          {notice && (
            <p
              className="border-brand-text/25 bg-brand-soft text-brand-text mt-5 max-w-3xl rounded-2xl border px-4 py-3 text-sm font-semibold"
              role="status"
            >
              {notice}
              {noticeAction && (
                <>
                  {" "}
                  <Link
                    className="link-underline underline-offset-2"
                    href={noticeAction.href}
                  >
                    {noticeAction.label}
                  </Link>
                </>
              )}
            </p>
          )}
          {subtypes && subtypes.length > 0 && subtypeBasePath && (
            <ul className="mt-7 flex flex-wrap gap-2">
              {subtypes.map((subtype) => (
                <li key={subtype.slug}>
                  <Link
                    className="border-border hover:border-brand-text/50 hover:text-brand-text inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold transition"
                    href={`${subtypeBasePath}/${subtype.slug}`}
                  >
                    {subtype.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <DirectorySearch
              // The section's own root, so a venue search never lands in the
              // vendor directory and vice versa.
              action={filterBasePath ?? basePath}
              category={category}
              city={city}
              compact
              hideCategory={hideCategoryControl}
              query={query}
            />
          </div>
        </div>
      </section>

      <section className="section-content mx-auto max-w-7xl px-5 md:px-8">
        {/* Prominent, above-the-fold disclosure rather than a small badge on
            each card and a low-contrast line in the footer. */}
        {previewCount > 0 && (
          <p className="border-border bg-muted text-muted-foreground mb-8 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6">
            <Info
              aria-hidden="true"
              className="text-brand-text mt-0.5 shrink-0"
              size={18}
            />
            <span>
              <strong className="text-foreground">
                {previewCount} of these{" "}
                {previewCount === 1 ? "listing is" : "listings are"} a fictional
                preview.
              </strong>{" "}
              Preview listings are design fixtures used while real vendor
              onboarding is built. They carry no ratings, reviews or
              verification, and cannot be shortlisted or contacted.
            </span>
          </p>
        )}

        <div className="border-border flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-brand-text text-sm font-bold">
              {displayTotal} {displayTotal === 1 ? "listing" : "listings"}
              {/* Say when a number is the result of filtering. Without it a
                  filtered view and an empty city look identical, and somebody
                  who has narrowed to two results cannot tell whether the
                  filters worked or the city is nearly empty. */}
              {filtered ? " matching your filters" : ""}
              {previewCount > 0 && total > 0
                ? ` · ${total} live, ${previewCount} preview`
                : ""}
            </p>
            <h2 className="type-heading mt-1">
              {query ? `Results for “${query}”` : "Available listings"}
            </h2>
          </div>
          <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <MapPin aria-hidden="true" size={16} /> More verified supply is
            added city by city.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr]">
          {facets ? (
            <div className="lg:sticky lg:top-24 lg:self-start">
              <FilterPanel
                basePath={filterBasePath ?? basePath}
                facets={facets}
                filters={activeFilters ?? {}}
              />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}

          <div>
            {vendors.length > 0 ? (
              <>
                <div className="reveal-stagger grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                  {vendors.map((vendor, index) => (
                    <VendorCard
                      key={vendor.slug}
                      priority={index < 3}
                      vendor={vendor}
                    />
                  ))}
                </div>
                {moreHref ? (
                  <div className="border-border mt-10 flex flex-col items-center gap-3 border-t pt-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      Showing the first {pageSize} of {total} listings.
                    </p>
                    <Link
                      className="bg-brand-solid hover:bg-brand-solid-hover inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition"
                      href={moreHref}
                    >
                      See all {total} listings{" "}
                      <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  </div>
                ) : (
                  <Pagination
                    basePath={basePath}
                    page={page}
                    pageHref={pageHref}
                    pageSize={pageSize}
                    filters={activeFilters ?? {}}
                    total={total}
                  />
                )}
              </>
            ) : (
              <div className="border-border bg-muted/45 mt-8 rounded-3xl border border-dashed px-6 py-16 text-center">
                <h2 className="type-heading">No matching listings yet</h2>
                <p className="text-muted-foreground mx-auto mt-3 max-w-lg leading-7">
                  {elsewhere && elsewhere.length > 0
                    ? "Nothing here yet — but these cities have them."
                    : "Try another city, category, or keyword. Real vendor supply is still being onboarded city by city."}
                </p>

                {elsewhere && elsewhere.length > 0 && (
                  <ul className="mt-6 flex flex-wrap justify-center gap-2">
                    {elsewhere.map((option) => (
                      <li key={option.href}>
                        <Link
                          className="border-border hover:border-brand-text/50 hover:text-brand-text inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold transition"
                          href={option.href}
                        >
                          {option.name}
                          <span className="text-muted-foreground text-xs">
                            {option.total}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  className="bg-brand-solid hover:bg-brand-solid-hover mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition"
                  href={basePath}
                >
                  Clear filters <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
