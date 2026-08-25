import { Search } from "lucide-react";

import { getCategories, getMetros } from "@/data/marketplace";

type DirectorySearchProps = {
  readonly city?: string;
  readonly category?: string;
  readonly query?: string;
  readonly compact?: boolean;
};

export function DirectorySearch({
  city,
  category,
  query,
  compact = false,
}: DirectorySearchProps) {
  return (
    <form
      action="/vendors"
      aria-labelledby="directory-search-heading"
      className={`border-border shadow-soft grid gap-2 rounded-3xl border bg-white p-2 ${compact ? "lg:grid-cols-[1fr_1fr_1.2fr_auto]" : "sm:grid-cols-[1fr_1fr_1.2fr_auto]"}`}
      role="search"
    >
      <h2 className="sr-only" id="directory-search-heading">
        Search wedding vendors
      </h2>
      <label className="bg-muted/55 rounded-2xl px-4 py-3">
        <span className="text-muted-foreground block text-[0.68rem] font-bold tracking-widest uppercase">
          Category
        </span>
        <select
          className="select-bare mt-1 min-h-8 w-full bg-transparent text-sm font-semibold"
          defaultValue={category ?? ""}
          name="category"
        >
          <option value="">All categories</option>
          {getCategories().map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="bg-muted/55 rounded-2xl px-4 py-3">
        <span className="text-muted-foreground block text-[0.68rem] font-bold tracking-widest uppercase">
          City
        </span>
        <select
          className="select-bare mt-1 min-h-8 w-full bg-transparent text-sm font-semibold"
          defaultValue={city ?? ""}
          name="city"
        >
          <option value="">All metros</option>
          {getMetros().map((metro) => (
            <option key={metro.slug} value={metro.slug}>
              {metro.name}
            </option>
          ))}
        </select>
      </label>
      <label className="bg-muted/55 rounded-2xl px-4 py-3">
        <span className="text-muted-foreground block text-[0.68rem] font-bold tracking-widest uppercase">
          Keywords
        </span>
        <input
          className="mt-1 min-h-8 w-full bg-transparent text-sm font-semibold placeholder:font-medium"
          defaultValue={query}
          maxLength={80}
          name="q"
          placeholder="Style, locality, service…"
          type="search"
        />
      </label>
      <button
        className="bg-brand-solid hover:bg-brand-solid-hover inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition"
        type="submit"
      >
        <Search aria-hidden="true" size={17} /> Search
      </button>
    </form>
  );
}
