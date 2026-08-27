import "server-only";

import { launchCategories } from "@/config/categories";
import type { PublicVendor, VendorSearch } from "@/domain/marketplace";

import { metros, vendors } from "./seed/marketplace";

export function getMetros() {
  return metros;
}

export function getCategories() {
  return launchCategories;
}

/**
 * The categories the vendor directory covers — everything except venues.
 *
 * Venues are browsed as their own section, so a list that mixes them in is
 * offering a choice the two things do not share.
 */
export function getServiceCategories() {
  return launchCategories.filter((category) => category.kind === "service");
}

export function getVenueCategory() {
  return launchCategories.find((category) => category.kind === "venue")!;
}

export function getMetroBySlug(slug: string) {
  return metros.find((metro) => metro.slug === slug);
}

export function getCategoryBySlug(slug: string) {
  return launchCategories.find((category) => category.slug === slug);
}

export function getVendorBySlug(slug: string): PublicVendor | undefined {
  return vendors.find((vendor) => vendor.slug === slug);
}

export function getAllDirectoryParams() {
  // Venues have their own routes, so /vendors/[city]/venues is not a page.
  return metros.flatMap((metro) =>
    getServiceCategories().map((category) => ({
      city: metro.slug,
      category: category.slug,
    })),
  );
}

export function searchVendors(search: VendorSearch = {}) {
  const query = search.query?.trim().toLocaleLowerCase("en-IN");

  return vendors.filter((vendor) => {
    if (search.city && vendor.citySlug !== search.city) return false;
    if (search.category && vendor.categorySlug !== search.category)
      return false;
    if (!query) return true;

    return [vendor.name, vendor.locality, vendor.summary, ...vendor.tags].some(
      (value) => value.toLocaleLowerCase("en-IN").includes(query),
    );
  });
}

/**
 * Related listings for a preview fixture, drawn only from other fixtures.
 *
 * Live listings use `getRelatedLiveVendors` instead — mixing fictional
 * fixtures into a real vendor's profile would present invented businesses as
 * genuine recommendations.
 */
export function getRelatedPreviewVendors(slug: string, limit = 3) {
  const vendor = getVendorBySlug(slug);
  if (!vendor) return [];

  return vendors
    .filter(
      (candidate) =>
        candidate.slug !== slug &&
        (candidate.categorySlug === vendor.categorySlug ||
          candidate.citySlug === vendor.citySlug),
    )
    .slice(0, limit);
}

/** Preview fixture slugs, prerendered at build time. */
export function getPreviewVendorSlugs() {
  return vendors.map(({ slug }) => ({ slug }));
}
