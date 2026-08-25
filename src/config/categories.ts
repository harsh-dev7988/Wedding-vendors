export type LaunchCategory = {
  readonly name: string;
  readonly slug: string;
  readonly symbol: string;
  readonly description: string;
  readonly image: string;
  readonly imageAlt: string;
};

export const launchCategories = [
  {
    name: "Venues",
    slug: "venues",
    symbol: "🏛️",
    description: "Banquets, lawns, resorts, hotels, and destination spaces.",
    image: "/images/generated/category-venues.webp",
    imageAlt:
      "An elegant palace courtyard wedding venue illuminated at blue hour",
  },
  {
    name: "Photographers",
    slug: "photographers",
    symbol: "📷",
    description: "Wedding, candid, cinematic, and pre-wedding teams.",
    image: "/images/generated/category-photographers.webp",
    imageAlt:
      "A wedding photographer capturing a laughing couple at golden hour",
  },
  {
    name: "Makeup artists",
    slug: "makeup-artists",
    symbol: "✨",
    description: "Bridal makeup, family makeup, trials, and travel.",
    image: "/images/generated/category-makeup.webp",
    imageAlt: "A makeup artist applying the finishing touch to a bride",
  },
  {
    name: "Planning & decor",
    slug: "planners-decorators",
    symbol: "🌼",
    description: "Full-service planners, coordinators, and decorators.",
    image: "/images/generated/category-planning-decor.webp",
    imageAlt:
      "Wedding planners preparing an ivory and marigold ceremony setting",
  },
  {
    name: "Caterers",
    slug: "caterers",
    symbol: "🍽️",
    description: "Menus, live counters, cakes, beverages, and service teams.",
    image: "/images/generated/category-catering.webp",
    imageAlt: "A wedding chef plating a contemporary Indian dish",
  },
] as const satisfies readonly LaunchCategory[];
