import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { filterHref, type ActiveFilters } from "@/lib/filters";

type PaginationProps = {
  readonly basePath: string;
  /**
   * Query parameters outside the marketplace filter vocabulary that still have
   * to survive a page change, such as the admin queue's status tab. Empty
   * values are dropped.
   */
  readonly extraParams?: Readonly<Record<string, string | undefined>>;
  readonly filters?: ActiveFilters;
  /** What is being paged through, for the "1-25 of 40 X" summary. */
  readonly noun?: string;
  readonly page: number;
  /**
   * Build a page's URL as a path instead of a `?page=` parameter.
   *
   * A prerendered directory cannot read `searchParams` without opting the whole
   * route into dynamic rendering, so its pages are real routes —
   * `/venues/mumbai/page/2`. That is also the better URL for a page a crawler
   * is meant to index.
   */
  readonly pageHref?: (page: number) => string;
  readonly pageSize: number;
  readonly total: number;
};

/**
 * The directory previously capped at 60 listings with no way forward, and
 * reported the page count as if it were the total.
 */
export function Pagination({
  basePath,
  extraParams,
  filters = {},
  noun = "listings",
  page,
  pageHref,
  pageSize,
  total,
}: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const hrefFor = (target: number) => {
    if (pageHref) return pageHref(target);
    const href = filterHref(basePath, { ...filters, page: target });
    const extras = Object.entries(extraParams ?? {}).filter(
      ([, value]) => value,
    );
    if (extras.length === 0) return href;
    const params = new URLSearchParams(extras as [string, string][]);
    return `${href}${href.includes("?") ? "&" : "?"}${params}`;
  };

  return (
    <nav
      aria-label="Listing pages"
      className="border-border mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
    >
      <p className="text-muted-foreground text-sm">
        Showing <strong className="text-foreground">{first}</strong>–
        <strong className="text-foreground">{last}</strong> of{" "}
        <strong className="text-foreground">{total}</strong> {noun}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-bold"
            href={hrefFor(page - 1)}
            rel="prev"
          >
            <ChevronLeft aria-hidden="true" size={16} /> Previous
          </Link>
        ) : (
          <span className="border-border text-muted-foreground inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm font-bold">
            <ChevronLeft aria-hidden="true" size={16} /> Previous
          </span>
        )}
        <span className="text-muted-foreground px-2 text-sm font-semibold">
          Page {page} of {lastPage}
        </span>
        {page < lastPage ? (
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-bold"
            href={hrefFor(page + 1)}
            rel="next"
          >
            Next <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ) : (
          <span className="border-border text-muted-foreground inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm font-bold">
            Next <ChevronRight aria-hidden="true" size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}
