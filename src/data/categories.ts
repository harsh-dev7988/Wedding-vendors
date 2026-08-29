import "server-only";

import { cache } from "react";

import { CATEGORY_MEDIA, FALLBACK_CATEGORIES } from "@/config/categories";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient as createSessionClient } from "@/lib/supabase/server";

/**
 * Categories, read from the database.
 *
 * They used to live in two places at once: a hand-written list in
 * `src/config/categories.ts` that the vendor form and the navigation read, and
 * the `categories` table that `listings.category_id` actually points at.
 * Nothing kept the two in step. With five categories written on the same
 * afternoon they happened to agree; at thirty-two, edited over time by more
 * than one person, they would not — and the failure is a vendor choosing a
 * category whose insert then fails, or a menu linking to a directory that 404s.
 *
 * The table is the source of truth. Config keeps only what the table has no
 * business holding: the illustration and its alt text.
 *
 * The fallback exists for one case — the database being unreachable during a
 * build. Shipping the last known category set is far better than shipping a
 * site with no navigation at all.
 */

/**
 * Slugs that moved, and where they moved to.
 *
 * `planners-decorators` was one category where the market has two: a planner
 * runs the day and a decorator builds the set, and vendors rarely do both well.
 * It held no listings when it was split, so the split cost nothing — but its
 * directory URLs were indexable, so they redirect rather than 404.
 *
 * A constant rather than a column: this list changes when a human decides a
 * category was wrong, which is not often, and the proxy cannot query anyway.
 */
export const SUPERSEDED_CATEGORIES: Readonly<Record<string, string>> = {
  "planners-decorators": "wedding-planners",
};

export type PriceUnit =
  | "per_plate"
  | "per_event"
  | "per_function"
  | "per_day"
  | "package"
  | "on_request"
  | "per_person"
  | "per_piece"
  | "per_kg"
  | "rental";

export type Category = {
  readonly allowedPriceUnits: readonly PriceUnit[];
  readonly description: string;
  readonly groupName: string;
  readonly groupSlug: string;
  readonly groupSort: number;
  readonly image?: string;
  readonly imageAlt?: string;
  readonly isActive: boolean;
  readonly kind: "venue" | "service";
  readonly name: string;
  /** Set for a subtype: `banquet-halls` has `venues` as its parent. */
  readonly parentSlug: string | null;
  readonly slug: string;
  readonly sortOrder: number;
};

type Row = {
  readonly allowed_price_units: readonly string[] | null;
  readonly description: string | null;
  readonly group_name: string;
  readonly group_slug: string;
  readonly group_sort: number;
  readonly is_active: boolean;
  readonly kind: string;
  readonly name: string;
  readonly parent_slug: string | null;
  readonly slug: string;
  readonly sort_order: number;
};

function decorate(row: Row): Category {
  const media = CATEGORY_MEDIA[row.slug];
  return {
    allowedPriceUnits: (row.allowed_price_units ?? [
      "on_request",
    ]) as readonly PriceUnit[],
    description: row.description ?? "",
    groupName: row.group_name,
    groupSlug: row.group_slug,
    groupSort: row.group_sort,
    image: media?.image,
    imageAlt: media?.imageAlt,
    isActive: row.is_active,
    kind: row.kind === "venue" ? "venue" : "service",
    name: row.name,
    parentSlug: row.parent_slug,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

/**
 * Every category this client is allowed to see.
 *
 * That is the active ones, and it is the database that decides: the
 * `public active categories` policy is `is_active`, so an inactive category is
 * not filtered out here — it never arrives. There is deliberately no accessor
 * that returns the inactive ones, because with the anon key there cannot be
 * one, and an accessor whose name promises rows RLS forbids is worse than none.
 *
 * The consequence worth knowing: a URL for an inactive category 404s. That is
 * right for a category nothing announces. A *superseded* category is a
 * different case, handled by `SUPERSEDED_CATEGORIES` — a constant precisely so
 * it keeps redirecting after the row goes quiet.
 */
export const getCategories = cache(async (): Promise<readonly Category[]> => {
  if (!isSupabaseConfigured()) return FALLBACK_CATEGORIES.map(decorate);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "name, slug, kind, is_active, sort_order, group_name, group_slug, group_sort, description, parent_slug, allowed_price_units",
    )
    .order("group_sort")
    .order("sort_order");

  if (error || !data || data.length === 0) {
    return FALLBACK_CATEGORIES.map(decorate);
  }

  return (data as unknown as Row[]).map(decorate);
});

/** Active service categories — everything the vendor directory covers. */
export async function getServiceCategories() {
  return (await getCategories()).filter(
    (category) => category.kind === "service",
  );
}

/** Active venue categories, the parent first. */
export async function getVenueCategories() {
  return (await getCategories()).filter(
    (category) => category.kind === "venue",
  );
}

/**
 * The top-level venue category.
 *
 * Falls back to the first venue category so a misconfigured table cannot make
 * this throw at render time — `/venues` returning something is better than
 * `/venues` crashing.
 */
export async function getVenueCategory(): Promise<Category> {
  const venues = await getCategories();
  return (
    venues.find(
      (category) => category.kind === "venue" && category.parentSlug === null,
    ) ??
    venues.find((category) => category.kind === "venue") ??
    decorate(FALLBACK_CATEGORIES[0])
  );
}

/**
 * A slug lookup that can be used synchronously inside a callback.
 *
 * `filter()` and `map()` cannot await, and resolving a category per item would
 * be a query per item anyway. Await this once, then look up as often as needed.
 */
export const getCategoryMap = cache(
  async (): Promise<ReadonlyMap<string, Category>> => {
    return new Map(
      (await getCategories()).map((category) => [category.slug, category]),
    );
  },
);

/** Resolves against every category, active or not. */
export async function getCategoryBySlug(
  slug: string | undefined,
): Promise<Category | undefined> {
  if (!slug) return undefined;
  return (await getCategoryMap()).get(slug);
}

/**
 * Every category a vendor may list in, promoted or not.
 *
 * Uses the session client rather than the anon one: the public policy on
 * `categories` is `is_active`, and a signed-in user has a second policy that
 * lifts it. That difference is the whole point — the public sees what is
 * promoted, a vendor sees the whole taxonomy.
 *
 * Without this the product had a loop with no exit: a mehendi artist could not
 * create a mehendi listing because the category was unpromoted, and it stayed
 * unpromoted because it had no listings. Publishing now promotes the category
 * on its own, in a trigger.
 */
export const getListableCategories = cache(
  async (): Promise<readonly Category[]> => {
    if (!isSupabaseConfigured()) return FALLBACK_CATEGORIES.map(decorate);

    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from("categories")
      .select(
        "name, slug, kind, is_active, sort_order, group_name, group_slug, group_sort, description, parent_slug, allowed_price_units",
      )
      .order("group_sort")
      .order("sort_order");

    // A signed-out caller falls back to the promoted set, which is what the
    // anon policy would have returned anyway.
    if (error || !data || data.length === 0) return getCategories();

    // A superseded category is readable — its slug still has to resolve so the
    // redirect works — but it must never be offered. Filing a new listing under
    // one would put it in a category whose every page redirects somewhere else.
    return (data as unknown as Row[])
      .map(decorate)
      .filter((category) => !(category.slug in SUPERSEDED_CATEGORIES));
  },
);

/**
 * Arranges categories for a two-level menu, preserving group order.
 *
 * Generic over the category shape so a caller that has decorated its list —
 * the city hub attaches a listing count to each — keeps those fields instead
 * of having them narrowed away.
 */
export function groupCategories<T extends Category>(categories: readonly T[]) {
  const groups = new Map<
    string,
    { categories: T[]; name: string; slug: string; sort: number }
  >();

  for (const category of categories) {
    const existing = groups.get(category.groupSlug);
    if (existing) existing.categories.push(category);
    else {
      groups.set(category.groupSlug, {
        categories: [category],
        name: category.groupName,
        slug: category.groupSlug,
        sort: category.groupSort,
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.sort - b.sort);
}

/** The promoted categories, grouped — what public navigation should show. */
export async function getCategoryGroups(kind?: "venue" | "service") {
  const categories = (await getCategories()).filter(
    (category) => !kind || category.kind === kind,
  );
  return groupCategories(categories);
}
