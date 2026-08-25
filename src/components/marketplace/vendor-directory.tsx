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
  readonly title: string;
  readonly description: string;
  readonly vendors: readonly PublicVendor[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly basePath: string;
  /** Set when a static landing page defers deeper pages to the search route. */
  readonly moreHref?: string;
  readonly city?: string;
  readonly category?: string;
  readonly query?: string;
  readonly facets?: ListingFacets;
  readonly activeFilters?: ActiveFilters;
};

export function VendorDirectory({
  title,
  description,
  vendors,
  total,
  page,
  pageSize,
  basePath,
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

  return (
    <main id="main-content">
      <section className="border-border bg-muted/60 border-b">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
          <p className="text-brand-text eyebrow">
            Wedding professionals across India
          </p>
          <h1 className="type-title mt-3 max-w-4xl md:text-5xl">{title}</h1>
          <p className="text-muted-foreground mt-4 max-w-3xl leading-7">
            {description}
          </p>
          <div className="mt-8">
            <DirectorySearch
              category={category}
              city={city}
              compact
              query={query}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
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
                basePath={basePath}
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
                  Try another city, category, or keyword. Real vendor supply is
                  still being onboarded city by city.
                </p>
                <Link
                  className="bg-brand-solid hover:bg-brand-solid-hover mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition"
                  href="/vendors"
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
