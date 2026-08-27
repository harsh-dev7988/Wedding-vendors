import "server-only";

import { cache } from "react";

import { metros } from "@/data/seed/marketplace";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export type City = {
  readonly name: string;
  readonly slug: string;
  readonly stateName: string | null;
};

/**
 * Last-resort list, used only when the database cannot be reached.
 *
 * Rendering a site with no cities at all — an empty navigation, an empty
 * footer, a directory that 404s — is a far worse outcome than briefly serving
 * a stale list during an outage.
 */
const FALLBACK: readonly City[] = metros.map((metro) => ({
  name: metro.name,
  slug: metro.slug,
  stateName: metro.region,
}));

/**
 * Every active city, from the database.
 *
 * This is the single source of truth for the navigation, the footer, the home
 * page, the search dropdowns, and slug validation. Cities used to be a
 * hardcoded array read by ten different files, which meant a city added in
 * Supabase got a directory page and appeared nowhere else — not in the menu,
 * not in the footer, not in any dropdown, and `?city=` for it was silently
 * ignored rather than filtered or refused.
 *
 * `cache()` dedupes within a request, so the header, footer and page body share
 * one query. The table is small and indexed; on a statically rendered route the
 * read happens at build time and costs a visitor nothing.
 */
export const getCities = cache(async (): Promise<readonly City[]> => {
  if (!isSupabaseConfigured()) return FALLBACK;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("cities")
    .select("name, slug, state_name")
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) return FALLBACK;

  return data.map((row) => ({
    name: row.name as string,
    slug: row.slug as string,
    stateName: (row.state_name as string | null) ?? null,
  }));
});

/** The city with this slug, or undefined. Undefined means "not a city" — the
 *  caller should 404 rather than silently ignoring the value. */
export async function getCityBySlug(slug: string | undefined) {
  if (!slug) return undefined;
  return (await getCities()).find((city) => city.slug === slug);
}
