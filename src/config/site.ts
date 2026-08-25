import { getSiteUrl } from "@/lib/env";

export const siteConfig = {
  name: "Wedding Vendor",
  url: getSiteUrl(),
  description:
    "Discover and connect with trusted wedding venues, photographers, makeup artists, planners, decorators, and caterers.",
} as const;

/**
 * A city/category page is only worth indexing once it has real supply.
 * `docs/PRODUCT_DECISIONS.md` sets the launch target at 25 approved listings;
 * below that the page is thin content and is served `noindex, follow`.
 */
export const INDEXABLE_SUPPLY_THRESHOLD = 25;

/** Listings per directory page. */
export const DIRECTORY_PAGE_SIZE = 24;
