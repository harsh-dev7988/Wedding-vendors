/**
 * Presentation for categories, and a last-resort seed.
 *
 * This file used to *be* the category list — the vendor form and the navigation
 * read it while `listings.category_id` pointed at the `categories` table, with
 * nothing keeping the two in step. The table is now the source of truth
 * (`src/data/categories.ts`); what remains here is the part a database row has
 * no business holding.
 *
 * A category without an illustration is expected, not a bug: there are
 * thirty-two of them and five images. Surfaces fall back to type.
 */

export type CategoryMedia = {
  readonly image: string;
  readonly imageAlt: string;
};

export const CATEGORY_MEDIA: Readonly<Record<string, CategoryMedia>> = {
  caterers: {
    image: "/images/generated/category-catering.webp",
    imageAlt: "A wedding chef plating a contemporary Indian dish",
  },
  "makeup-artists": {
    image: "/images/generated/category-makeup.webp",
    imageAlt: "A makeup artist applying the finishing touch to a bride",
  },
  photographers: {
    image: "/images/generated/category-photographers.webp",
    imageAlt:
      "A wedding photographer capturing a laughing couple at golden hour",
  },
  "wedding-planners": {
    image: "/images/generated/category-planning-decor.webp",
    imageAlt:
      "Wedding planners preparing an ivory and marigold ceremony setting",
  },
  venues: {
    image: "/images/generated/category-venues.webp",
    imageAlt:
      "An elegant palace courtyard wedding venue illuminated at blue hour",
  },
};

/**
 * The set to fall back on when the database is unreachable during a build.
 *
 * Not a mirror of the table and not meant to be kept in step with it: shipping
 * a site with five categories beats shipping one with no navigation at all.
 * Shaped like a database row so the same decoration path handles both.
 */
export const FALLBACK_CATEGORIES = [
  {
    allowed_price_units: ["per_plate", "per_event", "package", "on_request"],
    description: "Banquets, lawns, resorts, hotels, and destination spaces.",
    group_name: "Venues",
    group_slug: "venues",
    group_sort: 10,
    is_active: true,
    kind: "venue",
    name: "Venues",
    parent_slug: null,
    slug: "venues",
    sort_order: 10,
  },
  {
    allowed_price_units: ["per_event", "per_day", "package", "on_request"],
    description: "Wedding, candid, cinematic, and pre-wedding teams.",
    group_name: "Photography",
    group_slug: "photography",
    group_sort: 20,
    is_active: true,
    kind: "service",
    name: "Photographers",
    parent_slug: null,
    slug: "photographers",
    sort_order: 10,
  },
  {
    allowed_price_units: [
      "per_event",
      "per_function",
      "per_person",
      "package",
      "on_request",
    ],
    description: "Bridal makeup, family makeup, trials, and travel.",
    group_name: "Makeup",
    group_slug: "makeup",
    group_sort: 30,
    is_active: true,
    kind: "service",
    name: "Makeup artists",
    parent_slug: null,
    slug: "makeup-artists",
    sort_order: 10,
  },
  {
    allowed_price_units: ["per_event", "package", "on_request"],
    description: "Full-service planners who run the day end to end.",
    group_name: "Planning & Decor",
    group_slug: "planning-decor",
    group_sort: 40,
    is_active: true,
    kind: "service",
    name: "Wedding planners",
    parent_slug: null,
    slug: "wedding-planners",
    sort_order: 10,
  },
  {
    allowed_price_units: ["per_plate", "per_event", "package", "on_request"],
    description: "Menus, live counters, cakes, beverages, and service teams.",
    group_name: "Food",
    group_slug: "food",
    group_sort: 80,
    is_active: true,
    kind: "service",
    name: "Caterers",
    parent_slug: null,
    slug: "caterers",
    sort_order: 10,
  },
] as const;
