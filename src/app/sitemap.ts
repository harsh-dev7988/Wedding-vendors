import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import {
  getDirectorySupply,
  getLiveSitemapEntries,
  isIndexableDirectory,
} from "@/data/live-marketplace";

export const revalidate = 3600;

/**
 * Only real, indexable URLs are submitted.
 *
 * The sitemap used to advertise 11 fictional businesses and all 60 city/category
 * combinations — 49 of which had no listings at all — while containing no live
 * listing. Preview fixtures are now excluded entirely (they are also `noindex`),
 * directories appear only once they clear the supply threshold in
 * `docs/PRODUCT_DECISIONS.md`, and published listings are sourced from the
 * database.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteConfig.url, lastModified: now, priority: 1 },
    { url: `${siteConfig.url}/vendors`, lastModified: now, priority: 0.8 },
    { url: `${siteConfig.url}/for-vendors`, lastModified: now, priority: 0.6 },
    {
      url: `${siteConfig.url}/trust-and-safety`,
      lastModified: now,
      priority: 0.4,
    },
    { url: `${siteConfig.url}/terms`, lastModified: now, priority: 0.2 },
    { url: `${siteConfig.url}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${siteConfig.url}/contact`, lastModified: now, priority: 0.3 },
  ];

  const [supply, listings] = await Promise.all([
    getDirectorySupply(),
    getLiveSitemapEntries(),
  ]);

  const directories: MetadataRoute.Sitemap = supply
    .filter((entry) => isIndexableDirectory(entry.total))
    .map((entry) => ({
      url: `${siteConfig.url}/vendors/${entry.citySlug}/${entry.categorySlug}`,
      lastModified: now,
      priority: 0.7,
    }));

  const vendors: MetadataRoute.Sitemap = listings.map((entry) => ({
    url: `${siteConfig.url}/vendor/${entry.slug}`,
    lastModified: new Date(entry.updatedAt),
    priority: 0.6,
  }));

  return [...staticPages, ...directories, ...vendors];
}
