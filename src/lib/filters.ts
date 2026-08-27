export type ActiveFilters = {
  readonly category?: string;
  readonly city?: string;
  /** A search origin from "use my location". Serialised as `lat`/`lng`, the
   *  names the page parses, and carried through every chip and page change —
   *  otherwise applying a price filter would silently drop the origin and turn
   *  a proximity search back into a plain one. */
  readonly originLat?: number;
  readonly originLng?: number;
  readonly maxPrice?: number;
  readonly minPrice?: number;
  readonly minRating?: number;
  readonly page?: number;
  readonly pincode?: string;
  readonly q?: string;
  readonly radiusKm?: number;
  readonly sort?: string;
  readonly verifiedOnly?: boolean;
};

export const DEFAULT_SORT = "recent";

/**
 * One canonical encoding for filter state, shared by the chips, the pagination
 * and the page itself.
 *
 * Previously the chip links were built with `String(value)`, which turned
 * `verifiedOnly: true` into `verifiedOnly=true` while the parser only accepts
 * `"1"`. Removing any single chip therefore silently dropped the verified
 * filter as well. Defaults and empty values are omitted so the URL stays clean
 * and two identical result sets share one canonical address.
 */
export function serializeFilters(
  filters: ActiveFilters,
  omit: readonly (keyof ActiveFilters)[] = [],
) {
  const params = new URLSearchParams();
  const skip = new Set(omit);

  const text = (key: keyof ActiveFilters, value?: string) => {
    if (!skip.has(key) && value) params.set(key, value);
  };
  const number = (key: keyof ActiveFilters, value?: number) => {
    if (!skip.has(key) && typeof value === "number" && Number.isFinite(value)) {
      params.set(key, String(value));
    }
  };

  text("city", filters.city);
  text("category", filters.category);
  text("q", filters.q);
  // Only ever a pair — a lone coordinate is meaningless to the page.
  if (
    !skip.has("originLat") &&
    !skip.has("originLng") &&
    typeof filters.originLat === "number" &&
    typeof filters.originLng === "number"
  ) {
    params.set("lat", filters.originLat.toFixed(5));
    params.set("lng", filters.originLng.toFixed(5));
  }
  number("minPrice", filters.minPrice);
  number("maxPrice", filters.maxPrice);
  number("minRating", filters.minRating);
  text("pincode", filters.pincode);
  number("radiusKm", filters.radiusKm);
  // Booleans use the same "1" the parser expects, and are omitted when false.
  if (!skip.has("verifiedOnly") && filters.verifiedOnly) {
    params.set("verifiedOnly", "1");
  }
  // The default sort is implicit, so it never appears in the URL.
  if (!skip.has("sort") && filters.sort && filters.sort !== DEFAULT_SORT) {
    params.set("sort", filters.sort);
  }
  // Page 1 is implicit too.
  if (!skip.has("page") && filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return params;
}

export function filterHref(
  basePath: string,
  filters: ActiveFilters,
  omit: readonly (keyof ActiveFilters)[] = [],
) {
  const query = serializeFilters(filters, omit).toString();
  return query ? `${basePath}?${query}` : basePath;
}
