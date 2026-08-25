import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import type { ListingFacets } from "@/data/live-marketplace";
import { formatIndianPrice } from "@/lib/format";

export type ActiveFilters = {
  readonly category?: string;
  readonly city?: string;
  readonly maxPrice?: number;
  readonly minPrice?: number;
  readonly minRating?: number;
  readonly pincode?: string;
  readonly q?: string;
  readonly radiusKm?: number;
  readonly sort?: string;
  readonly verifiedOnly?: boolean;
};

const SORTS = [
  { label: "Most recent", value: "recent" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Price: high to low", value: "price_desc" },
  { label: "Highest rated", value: "rating" },
  { label: "Most experienced", value: "experience" },
  { label: "Fastest to respond", value: "response" },
  { label: "Nearest", value: "distance" },
] as const;

const RATINGS = [
  { label: "Any rating", value: "" },
  { label: "4.5+", value: "4.5" },
  { label: "4+", value: "4" },
  { label: "3+", value: "3" },
] as const;

const RADII = [
  { label: "Any distance", value: "" },
  { label: "Within 5 km", value: "5" },
  { label: "Within 10 km", value: "10" },
  { label: "Within 25 km", value: "25" },
  { label: "Within 50 km", value: "50" },
] as const;

/** Human-readable summary of what is currently applied, each with a remove link. */
function activeChips(filters: ActiveFilters, basePath: string) {
  const chips: Array<{ href: string; label: string }> = [];
  const without = (keys: readonly (keyof ActiveFilters)[]) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (keys.includes(key as keyof ActiveFilters)) continue;
      if (value === undefined || value === "" || value === false) continue;
      params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  if (filters.minPrice || filters.maxPrice) {
    const from = filters.minPrice ? formatIndianPrice(filters.minPrice) : "Any";
    const to = filters.maxPrice ? formatIndianPrice(filters.maxPrice) : "Any";
    chips.push({
      href: without(["minPrice", "maxPrice"]),
      label: `${from} – ${to}`,
    });
  }
  if (filters.minRating) {
    chips.push({
      href: without(["minRating"]),
      label: `${filters.minRating}+ rating`,
    });
  }
  if (filters.verifiedOnly) {
    chips.push({ href: without(["verifiedOnly"]), label: "Verified only" });
  }
  if (filters.pincode) {
    chips.push({
      href: without(["pincode", "radiusKm"]),
      label: filters.radiusKm
        ? `${filters.radiusKm} km of ${filters.pincode}`
        : `Near ${filters.pincode}`,
    });
  }
  if (filters.q) {
    chips.push({ href: without(["q"]), label: `“${filters.q}”` });
  }
  return chips;
}

/**
 * Faceted filters, rendered as a plain GET form.
 *
 * State lives in the URL, so a filtered view is shareable, server-rendered and
 * works without JavaScript. Price bounds come from `listing_facets` rather than
 * being invented, so the slider never offers a range with nothing in it.
 */
export function FilterPanel({
  basePath,
  facets,
  filters,
}: {
  readonly basePath: string;
  readonly facets: ListingFacets;
  readonly filters: ActiveFilters;
}) {
  const chips = activeChips(filters, basePath);
  const hasPriceData = facets.minPrice !== null && facets.maxPrice !== null;

  return (
    <section
      aria-labelledby="filters-heading"
      className="border-border rounded-3xl border bg-white p-5"
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold"
        id="filters-heading"
      >
        <SlidersHorizontal
          aria-hidden="true"
          className="text-brand-text"
          size={16}
        />
        Refine
      </h2>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.label}>
              <Link
                className="bg-brand-soft text-brand-text hover:bg-brand-soft/70 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition"
                href={chip.href}
              >
                {chip.label}
                <X aria-hidden="true" size={13} />
                <span className="sr-only">Remove this filter</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={basePath} className="mt-4 grid gap-4">
        {/* Carried through so refining never silently drops the city,
            category or keyword the visitor already chose. */}
        {filters.city && (
          <input name="city" type="hidden" value={filters.city} />
        )}
        {filters.category && (
          <input name="category" type="hidden" value={filters.category} />
        )}
        {filters.q && <input name="q" type="hidden" value={filters.q} />}

        <fieldset className="grid gap-2">
          <legend className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Budget
          </legend>
          {hasPriceData && (
            <p className="text-muted-foreground text-xs">
              Listings here range from {formatIndianPrice(facets.minPrice!)} to{" "}
              {formatIndianPrice(facets.maxPrice!)}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-bold" htmlFor="minPrice">
              Min ₹
              <input
                className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
                defaultValue={filters.minPrice ?? ""}
                id="minPrice"
                inputMode="numeric"
                min={0}
                name="minPrice"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold" htmlFor="maxPrice">
              Max ₹
              <input
                className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
                defaultValue={filters.maxPrice ?? ""}
                id="maxPrice"
                inputMode="numeric"
                min={0}
                name="maxPrice"
                type="number"
              />
            </label>
          </div>
        </fieldset>

        <label className="grid gap-1 text-xs font-bold" htmlFor="minRating">
          <span className="text-muted-foreground tracking-widest uppercase">
            Rating
          </span>
          <select
            className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
            defaultValue={filters.minRating ? String(filters.minRating) : ""}
            id="minRating"
            name="minRating"
          >
            {RATINGS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Near a pincode
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-bold" htmlFor="pincode">
              Pincode
              <input
                className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
                defaultValue={filters.pincode ?? ""}
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                name="pincode"
                pattern="[1-9][0-9]{5}"
                placeholder="400001"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold" htmlFor="radiusKm">
              Distance
              <select
                className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
                defaultValue={filters.radiusKm ? String(filters.radiusKm) : ""}
                id="radiusKm"
                name="radiusKm"
              >
                {RADII.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm font-bold">
          <input
            className="mt-0.5 size-5 shrink-0 accent-[color:var(--brand-solid)]"
            defaultChecked={filters.verifiedOnly}
            name="verifiedOnly"
            type="checkbox"
            value="1"
          />
          <span>
            Verified businesses only
            <span className="text-muted-foreground block text-xs font-medium">
              {facets.verifiedCount} of {facets.total} here are verified
            </span>
          </span>
        </label>

        <label className="grid gap-1 text-xs font-bold" htmlFor="sort">
          <span className="text-muted-foreground tracking-widest uppercase">
            Sort by
          </span>
          <select
            className="border-border min-h-11 rounded-xl border px-3 text-sm font-medium"
            defaultValue={filters.sort ?? "recent"}
            id="sort"
            name="sort"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="bg-brand-solid hover:bg-brand-solid-hover min-h-11 flex-1 rounded-full px-4 text-sm font-bold text-white transition"
            type="submit"
          >
            Apply filters
          </button>
          {chips.length > 0 && (
            <Link
              className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition"
              href={basePath}
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
