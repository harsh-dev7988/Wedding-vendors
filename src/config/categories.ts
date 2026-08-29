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
  accessories: {
    image: "/images/generated/category-accessories.webp",
    imageAlt:
      "A stylist arranging embroidered clutches, juttis, kalire, and dupattas",
  },
  "banquet-halls": {
    image: "/images/generated/category-banquet-halls.webp",
    imageAlt:
      "An indoor wedding banquet hall dressed with warm lights and flowers",
  },
  bartenders: {
    image: "/images/generated/category-bartenders.webp",
    imageAlt: "A mixologist pouring a drink at a warmly lit wedding bar",
  },
  "beauty-and-wellness": {
    image: "/images/generated/category-beauty-and-wellness.webp",
    imageAlt:
      "A calm treatment room with warm linen, brass bowls, and soft daylight",
  },
  "bridal-wear": {
    image: "/images/generated/category-bridal-wear.webp",
    imageAlt: "Hands inspecting embroidered bridal lehengas on a boutique rail",
  },
  caterers: {
    image: "/images/generated/category-catering.webp",
    imageAlt: "A wedding chef plating a contemporary Indian dish",
  },
  decorators: {
    image: "/images/generated/category-decorators.webp",
    imageAlt:
      "Decorators fixing floral garlands and drapes onto a wedding mandap",
  },
  "destination-venues": {
    image: "/images/generated/category-destination-venues.webp",
    imageAlt:
      "A hilltop palace courtyard being prepared for a wedding at sunset",
  },
  djs: {
    image: "/images/generated/category-djs.webp",
    imageAlt: "Wedding guests dancing beneath amber lights at a sangeet",
  },
  "family-makeup": {
    image: "/images/generated/category-family-makeup.webp",
    imageAlt:
      "Family members being readied together by makeup artists at mirrors",
  },
  farmhouses: {
    image: "/images/generated/category-farmhouses.webp",
    imageAlt:
      "A private farmhouse lawn set with string lights for an evening wedding",
  },
  "groom-wear": {
    image: "/images/generated/category-groom-wear.webp",
    imageAlt:
      "A tailor adjusting an embroidered sherwani cuff beside a boutique rail",
  },
  invitations: {
    image: "/images/generated/category-invitations.webp",
    imageAlt:
      "Hands holding blank gold-foiled wedding invitations beside marigolds",
  },
  jewellery: {
    image: "/images/generated/category-jewellery.webp",
    imageAlt:
      "A jeweller arranging polki and gold bridal jewellery on folded silk",
  },
  "kalyana-mandapams": {
    image: "/images/generated/category-kalyana-mandapams.webp",
    imageAlt:
      "A pillared South Indian wedding hall decorated with garlands and banana leaves",
  },
  "luxury-hotels": {
    image: "/images/generated/category-luxury-hotels.webp",
    imageAlt:
      "A formal wedding ballroom glowing beneath rows of crystal chandeliers",
  },
  "makeup-artists": {
    image: "/images/generated/category-makeup.webp",
    imageAlt: "A makeup artist applying the finishing touch to a bride",
  },
  "marriage-lawns": {
    image: "/images/generated/category-marriage-lawns.webp",
    imageAlt:
      "An open-air wedding lawn illuminated by string lights at blue hour",
  },
  "mehendi-artists": {
    image: "/images/generated/category-mehendi-artists.webp",
    imageAlt: "A mehendi artist applying intricate henna to a bride's hands",
  },
  photographers: {
    image: "/images/generated/category-photographers.webp",
    imageAlt:
      "A wedding photographer capturing a laughing couple at golden hour",
  },
  "pre-wedding-photographers": {
    image: "/images/generated/category-pre-wedding-photographers.webp",
    imageAlt:
      "A photographer capturing a couple against a lake and hills at golden hour",
  },
  "sangeet-choreographers": {
    image: "/images/generated/category-sangeet-choreographers.webp",
    imageAlt: "A family rehearsing a sangeet dance with their choreographer",
  },
  "small-function-halls": {
    image: "/images/generated/category-small-function-halls.webp",
    imageAlt:
      "An intimate function room prepared with floor seating and marigold garlands",
  },
  "trousseau-packers": {
    image: "/images/generated/category-trousseau-packers.webp",
    imageAlt: "Folded silk saris being arranged in a decorated trousseau tray",
  },
  "wedding-planners": {
    image: "/images/generated/category-planning-decor.webp",
    imageAlt:
      "Wedding planners preparing an ivory and marigold ceremony setting",
  },
  "wedding-cakes": {
    image: "/images/generated/category-wedding-cakes.webp",
    imageAlt:
      "A pastry chef adding flowers to an ivory and gold tiered wedding cake",
  },
  "wedding-entertainment": {
    image: "/images/generated/category-wedding-entertainment.webp",
    imageAlt: "Dhol players performing for wedding guests in golden light",
  },
  "wedding-favours": {
    image: "/images/generated/category-wedding-favours.webp",
    imageAlt: "Hands arranging marigold-topped wedding favour boxes on a table",
  },
  "wedding-hotels": {
    image: "/images/generated/category-wedding-hotels.webp",
    imageAlt:
      "A hotel ballroom prepared with a draped stage and reception tables",
  },
  "wedding-resorts": {
    image: "/images/generated/category-wedding-resorts.webp",
    imageAlt:
      "A resort courtyard set with a floral mandap beside reflecting pools",
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
