import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  readonly basePath: string;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly searchParams?: Record<string, string | undefined>;
};

function hrefFor(
  basePath: string,
  page: number,
  searchParams: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * The directory previously capped at 60 listings with no way forward, and
 * reported the page count as if it were the total.
 */
export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  searchParams = {},
}: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Listing pages"
      className="border-border mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
    >
      <p className="text-muted-foreground text-sm">
        Showing <strong className="text-foreground">{first}</strong>–
        <strong className="text-foreground">{last}</strong> of{" "}
        <strong className="text-foreground">{total}</strong> listings
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-bold"
            href={hrefFor(basePath, page - 1, searchParams)}
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
            href={hrefFor(basePath, page + 1, searchParams)}
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
