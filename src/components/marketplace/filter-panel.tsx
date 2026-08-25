"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { ListingFacets } from "@/data/live-marketplace";
import { DEFAULT_SORT, filterHref, type ActiveFilters } from "@/lib/filters";
import { formatIndianPrice } from "@/lib/format";

export type { ActiveFilters };

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
  { label: "4.5 and above", value: "4.5" },
  { label: "4 and above", value: "4" },
  { label: "3 and above", value: "3" },
] as const;

const RADII = [
  { label: "Any distance", value: "" },
  { label: "Within 5 km", value: "5" },
  { label: "Within 10 km", value: "10" },
  { label: "Within 25 km", value: "25" },
  { label: "Within 50 km", value: "50" },
] as const;

const SELECT_CLASS =
  "border-border select-field focus:border-brand-text min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold transition";
const INPUT_CLASS =
  "border-border focus:border-brand-text min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold transition";

function chipsFor(filters: ActiveFilters, basePath: string) {
  const chips: Array<{ href: string; label: string }> = [];

  if (filters.minPrice || filters.maxPrice) {
    const from = filters.minPrice ? formatIndianPrice(filters.minPrice) : "Any";
    const to = filters.maxPrice ? formatIndianPrice(filters.maxPrice) : "Any";
    chips.push({
      href: filterHref(basePath, filters, ["minPrice", "maxPrice"]),
      label: `${from} – ${to}`,
    });
  }
  if (filters.minRating) {
    chips.push({
      href: filterHref(basePath, filters, ["minRating"]),
      label: `${filters.minRating}★ and above`,
    });
  }
  if (filters.verifiedOnly) {
    chips.push({
      href: filterHref(basePath, filters, ["verifiedOnly"]),
      label: "Verified only",
    });
  }
  if (filters.pincode) {
    chips.push({
      href: filterHref(basePath, filters, ["pincode", "radiusKm"]),
      label: filters.radiusKm
        ? `${filters.radiusKm} km of ${filters.pincode}`
        : `Near ${filters.pincode}`,
    });
  }
  if (filters.q) {
    chips.push({
      href: filterHref(basePath, filters, ["q"]),
      label: `“${filters.q}”`,
    });
  }
  return chips;
}

/**
 * Faceted filters as a GET form: state lives in the URL, so a filtered view is
 * shareable and server-rendered, and it still submits without JavaScript.
 *
 * The one client-side enhancement is stripping empty fields on submit —
 * otherwise every apply produced `?minPrice=&maxPrice=&minRating=` and two
 * identical result sets ended up with two different URLs.
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
  const chips = chipsFor(filters, basePath);
  const [open, setOpen] = useState(false);
  const hasPriceRange =
    facets.minPrice !== null &&
    facets.maxPrice !== null &&
    facets.maxPrice > facets.minPrice;

  // Empty controls are disabled at submit time so the browser omits them. The
  // handler runs before navigation but after the values are read, so nothing
  // the visitor entered is lost.
  const stripEmpty = (event: FormEvent<HTMLFormElement>) => {
    for (const field of Array.from(event.currentTarget.elements)) {
      const el = field as HTMLInputElement | HTMLSelectElement;
      if (!el.name || el.tagName === "BUTTON") continue;
      if (
        el.value === "" ||
        (el.name === "sort" && el.value === DEFAULT_SORT)
      ) {
        el.disabled = true;
      }
    }
  };

  return (
    <section
      aria-labelledby="filters-heading"
      className="border-border rounded-3xl border bg-white"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-5 py-4">
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
          {chips.length > 0 && (
            <span className="bg-brand-solid rounded-full px-2 py-0.5 text-xs text-white">
              {chips.length}
            </span>
          )}
        </h2>
        {/* Collapsed by default on mobile, where a full-width panel above the
            results pushed every listing below the fold. */}
        <button
          aria-controls="filter-fields"
          aria-expanded={open}
          className="border-border min-h-9 rounded-full border px-3 text-xs font-bold lg:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {chips.length > 0 && (
        <ul className="border-border flex flex-wrap gap-2 border-b px-5 py-3">
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

      <form
        action={basePath}
        className={`grid gap-4 px-5 py-4 ${open ? "" : "hidden lg:grid"}`}
        id="filter-fields"
        onSubmit={stripEmpty}
      >
        {/* Carried through so refining never drops the city, category or
            keyword the visitor already chose. */}
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
          {hasPriceRange && (
            <p className="text-muted-foreground text-xs leading-5">
              Listings here run {formatIndianPrice(facets.minPrice!)} to{" "}
              {formatIndianPrice(facets.maxPrice!)}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-bold" htmlFor="minPrice">
              Min ₹
              <input
                className={INPUT_CLASS}
                defaultValue={filters.minPrice ?? ""}
                id="minPrice"
                inputMode="numeric"
                min={0}
                name="minPrice"
                placeholder="Any"
                type="number"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold" htmlFor="maxPrice">
              Max ₹
              <input
                className={INPUT_CLASS}
                defaultValue={filters.maxPrice ?? ""}
                id="maxPrice"
                inputMode="numeric"
                min={0}
                name="maxPrice"
                placeholder="Any"
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
            className={SELECT_CLASS}
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
                className={INPUT_CLASS}
                defaultValue={filters.pincode ?? ""}
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                name="pincode"
                pattern="[1-9][0-9]{5}"
                placeholder="400001"
                title="Six digits, not starting with zero"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold" htmlFor="radiusKm">
              Distance
              <select
                className={SELECT_CLASS}
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

        <label className="border-border flex items-start gap-3 rounded-xl border p-3 text-sm font-bold">
          <input
            className="mt-0.5 size-5 shrink-0 accent-[color:var(--brand-solid)]"
            defaultChecked={filters.verifiedOnly}
            name="verifiedOnly"
            type="checkbox"
            value="1"
          />
          <span>
            Verified businesses only
            {facets.total > 0 && (
              <span className="text-muted-foreground block text-xs font-medium">
                {facets.verifiedCount} of {facets.total} here are verified
              </span>
            )}
          </span>
        </label>

        <label className="grid gap-1 text-xs font-bold" htmlFor="sort">
          <span className="text-muted-foreground tracking-widest uppercase">
            Sort by
          </span>
          <select
            className={SELECT_CLASS}
            defaultValue={filters.sort ?? DEFAULT_SORT}
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
              href={filterHref(basePath, {
                category: filters.category,
                city: filters.city,
              })}
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
