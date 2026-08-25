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
  return metros.flatMap((metro) =>
    launchCategories.map((category) => ({
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
