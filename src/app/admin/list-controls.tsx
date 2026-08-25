import { Search } from "lucide-react";
import Link from "next/link";

export type StatusOption = { readonly label: string; readonly value: string };

/**
 * Search box plus status tabs, shared by the admin list views.
 *
 * A GET form rather than a client component: the query lives in the URL, so a
 * filtered queue is linkable between moderators and survives a reload, and the
 * page stays server-rendered.
 */
export function ListControls({
  basePath,
  placeholder,
  query,
  status,
  statuses,
}: {
  readonly basePath: string;
  readonly placeholder: string;
  readonly query: string;
  readonly status: string;
  readonly statuses: readonly StatusOption[];
}) {
  return (
    <div className="mt-8 space-y-4">
      <form action={basePath} className="flex flex-wrap gap-2" role="search">
        {/* Carried through so searching does not silently reset the tab. */}
        {status && <input name="status" type="hidden" value={status} />}
        <label className="flex-1" htmlFor="admin-search">
          <span className="sr-only">{placeholder}</span>
          <input
            className="border-border focus:border-brand-text min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
            defaultValue={query}
            id="admin-search"
            maxLength={120}
            name="q"
            placeholder={placeholder}
            type="search"
          />
        </label>
        <button
          className="bg-foreground inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
          type="submit"
        >
          <Search aria-hidden="true" size={16} /> Search
        </button>
        {query && (
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold"
            href={status ? `${basePath}?status=${status}` : basePath}
          >
            Clear
          </Link>
        )}
      </form>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {statuses.map((item) => {
            const active = item.value === status;
            const params = new URLSearchParams();
            if (item.value) params.set("status", item.value);
            if (query) params.set("q", query);
            const search = params.toString();
            return (
              <li key={item.label}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? "bg-foreground text-white"
                      : "border-border hover:border-brand-text/50 border"
                  }`}
                  href={search ? `${basePath}?${search}` : basePath}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/**
 * `%` and `_` are wildcards in `ilike`, so a moderator searching for a literal
 * one would otherwise match everything.
 */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
