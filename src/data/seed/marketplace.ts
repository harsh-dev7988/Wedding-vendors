import type { Metro, PublicVendor } from "@/domain/marketplace";

export const metros = [
  {
    name: "Delhi NCR",
    slug: "delhi-ncr",
    region: "North India",
    shortLabel: "Delhi",
  },
  {
    name: "Mumbai",
    slug: "mumbai",
    region: "West India",
    shortLabel: "Mumbai",
  },
  {
    name: "Bengaluru",
    slug: "bengaluru",
    region: "South India",
    shortLabel: "Bengaluru",
  },
  {
    name: "Hyderabad",
    slug: "hyderabad",
    region: "South India",
    shortLabel: "Hyderabad",
  },
  {
    name: "Chennai",
    slug: "chennai",
    region: "South India",
    shortLabel: "Chennai",
  },
  {
    name: "Kolkata",
    slug: "kolkata",
    region: "East India",
    shortLabel: "Kolkata",
  },
  { name: "Pune", slug: "pune", region: "West India", shortLabel: "Pune" },
  {
    name: "Ahmedabad",
    slug: "ahmedabad",
    region: "West India",
    shortLabel: "Ahmedabad",
  },
  {
    name: "Jaipur",
    slug: "jaipur",
    region: "North India",
    shortLabel: "Jaipur",
  },
  { name: "Surat", slug: "surat", region: "West India", shortLabel: "Surat" },
  { name: "Kochi", slug: "kochi", region: "South India", shortLabel: "Kochi" },
  {
    name: "Chandigarh",
    slug: "chandigarh",
    region: "North India",
    shortLabel: "Chandigarh",
  },
] as const satisfies readonly Metro[];

/**
 * Fictional fixtures used to build and review the marketplace experience.
 *
 * These carry no rating, no review count, no verification badge and no
 * response-time claim. Inventing those would put fabricated trust signals
 * about named "businesses" on a public page, which `docs/PRODUCT_DECISIONS.md`
 * forbids — and every one of them was previously submitted to search engines.
 * What remains is the design surface: name, place, price band and copy.
 *
 * They also never carry a `listingId`, which is the single gate that makes
 * shortlisting, enquiries, reveals and reviews impossible against them.
 */
export const vendors = [
  {
    slug: "saffron-courtyard",
    name: "Saffron Courtyard",
    categorySlug: "venues",
    citySlug: "delhi-ncr",
    locality: "Chattarpur",
    summary:
      "A sunlit garden venue for intimate celebrations and grand evening receptions.",
    description:
      "Saffron Courtyard pairs landscaped lawns with an ivory indoor hall, flexible ceremony spaces, and a dedicated guest arrival court. The team supports decor load-in, valet operations, and multi-event wedding schedules.",
    image: "/images/generated/category-venues.webp",
    imageAlt: "A palace-style courtyard venue lit for an evening reception",
    media: [
      {
        url: "/images/generated/category-venues.webp",
        alt: "A palace-style courtyard venue lit for an evening reception",
      },
      {
        url: "/images/generated/inspiration-details.webp",
        alt: "Marigolds, jasmine and stationery arranged on ivory linen",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 3200,
    priceUnit: "per plate",
    tags: ["Outdoor lawn", "Indoor hall", "250–800 guests"],
    yearsInBusiness: 9,
    responseTime: null,
  },
  {
    slug: "harbour-house",
    name: "Harbour House",
    categorySlug: "venues",
    citySlug: "mumbai",
    locality: "Bandra West",
    summary:
      "A contemporary celebration space with terraces, sea air, and warm modern interiors.",
    description:
      "Harbour House is designed for city weddings that need one polished address for ceremonies, cocktails, and dinner. Its indoor-outdoor plan works well for compact guest lists and weather-conscious celebrations.",
    image: "/images/generated/hero-celebration.webp",
    imageAlt: "A couple walking beneath a marigold canopy as guests celebrate",
    media: [
      {
        url: "/images/generated/hero-celebration.webp",
        alt: "A couple walking beneath a marigold canopy as guests celebrate",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 3800,
    priceUnit: "per plate",
    tags: ["Terrace", "Indoor spaces", "120–400 guests"],
    yearsInBusiness: 7,
    responseTime: null,
  },
  {
    slug: "ivory-courtyard-jaipur",
    name: "Ivory Courtyard",
    categorySlug: "venues",
    citySlug: "jaipur",
    locality: "Amer Road",
    summary:
      "A heritage-inspired courtyard with destination-wedding accommodation and ceremony lawns.",
    description:
      "Ivory Courtyard brings together warm sandstone architecture, guest rooms, and flexible outdoor settings. Its planning team supports welcome dinners, daytime ceremonies, and reception transformations.",
    image: "/images/generated/real-wedding-feature.webp",
    imageAlt:
      "A newly married couple sharing a candid laugh after the ceremony",
    media: [
      {
        url: "/images/generated/real-wedding-feature.webp",
        alt: "A newly married couple sharing a candid laugh after the ceremony",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 285000,
    priceUnit: "per event",
    tags: ["Destination", "Guest rooms", "Heritage setting"],
    yearsInBusiness: 11,
    responseTime: null,
  },
  {
    slug: "mogra-frames",
    name: "Mogra Frames",
    categorySlug: "photographers",
    citySlug: "mumbai",
    locality: "Andheri West",
    summary:
      "Documentary wedding photographs with warm colour, honest movement, and quiet portraits.",
    description:
      "Mogra Frames is a compact photography and film team focused on unscripted moments. Coverage can include pre-wedding events, the main ceremony, cinematic highlights, and carefully edited albums.",
    image: "/images/generated/category-photographers.webp",
    imageAlt:
      "A wedding photographer capturing a laughing couple at golden hour",
    media: [
      {
        url: "/images/generated/category-photographers.webp",
        alt: "A wedding photographer capturing a laughing couple at golden hour",
      },
      {
        url: "/images/generated/real-wedding-feature.webp",
        alt: "A newly married couple sharing a candid laugh after the ceremony",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 165000,
    priceUnit: "per event",
    tags: ["Candid", "Wedding films", "Travels across India"],
    yearsInBusiness: 8,
    responseTime: null,
  },
  {
    slug: "golden-hour-stories",
    name: "Golden Hour Stories",
    categorySlug: "photographers",
    citySlug: "bengaluru",
    locality: "Indiranagar",
    summary:
      "An editorial photo and film studio for expressive, people-first wedding stories.",
    description:
      "Golden Hour Stories blends candid coverage with relaxed portrait direction. The team offers multi-day coverage, short films, documentary edits, and destination travel from Bengaluru.",
    image: "/images/generated/vendor-studio.webp",
    imageAlt: "A wedding business team reviewing their portfolio in a studio",
    media: [
      {
        url: "/images/generated/vendor-studio.webp",
        alt: "A wedding business team reviewing their portfolio in a studio",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 145000,
    priceUnit: "per event",
    tags: ["Editorial", "Candid", "Short films"],
    yearsInBusiness: 6,
    responseTime: null,
  },
  {
    slug: "nila-bridal-studio",
    name: "Nila Bridal Studio",
    categorySlug: "makeup-artists",
    citySlug: "chennai",
    locality: "Alwarpet",
    summary:
      "Polished bridal beauty with skin-first preparation and calm on-location service.",
    description:
      "Nila Bridal Studio creates refined looks suited to each celebration and outfit. Bridal packages can include trials, hairstyling, draping, lashes, and travel within the city.",
    image: "/images/generated/category-makeup.webp",
    imageAlt: "A makeup artist applying the finishing touch to a bride",
    media: [
      {
        url: "/images/generated/category-makeup.webp",
        alt: "A makeup artist applying the finishing touch to a bride",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 32000,
    priceUnit: "per function",
    tags: ["HD makeup", "Hair & draping", "Travels to venue"],
    yearsInBusiness: 10,
    responseTime: null,
  },
  {
    slug: "noor-and-bloom",
    name: "Noor & Bloom",
    categorySlug: "makeup-artists",
    citySlug: "delhi-ncr",
    locality: "Greater Kailash",
    summary:
      "Modern bridal makeup with luminous finishes, considered colour, and reliable timelines.",
    description:
      "Noor & Bloom works with brides and close family across wedding events. The studio offers consultations, trials, hairstyling, draping, and destination travel by arrangement.",
    image: "/images/generated/inspiration-details.webp",
    imageAlt: "Marigolds, jasmine, jewellery and stationery on ivory linen",
    media: [
      {
        url: "/images/generated/inspiration-details.webp",
        alt: "Marigolds, jasmine, jewellery and stationery on ivory linen",
      },
      {
        url: "/images/generated/category-makeup.webp",
        alt: "A makeup artist applying the finishing touch to a bride",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 38000,
    priceUnit: "per function",
    tags: ["Airbrush", "Bridal trials", "Destination travel"],
    yearsInBusiness: 7,
    responseTime: null,
  },
  {
    slug: "mango-leaf-events",
    name: "Mango Leaf Events",
    categorySlug: "wedding-planners",
    citySlug: "hyderabad",
    locality: "Jubilee Hills",
    summary:
      "Planning and decor for thoughtful celebrations built around place, family, and flow.",
    description:
      "Mango Leaf Events manages design, vendor coordination, production schedules, and guest experience. Its decor work combines contemporary structure with locally grounded floral and material choices.",
    image: "/images/generated/category-planning-decor.webp",
    imageAlt:
      "Wedding planners preparing an ivory and marigold ceremony setting",
    media: [
      {
        url: "/images/generated/category-planning-decor.webp",
        alt: "Wedding planners preparing an ivory and marigold ceremony setting",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 275000,
    priceUnit: "per event",
    tags: ["Full planning", "Decor production", "Guest management"],
    yearsInBusiness: 9,
    responseTime: null,
  },
  {
    slug: "aster-and-marigold",
    name: "Aster & Marigold",
    categorySlug: "wedding-planners",
    citySlug: "kolkata",
    locality: "Ballygunge",
    summary:
      "Artful event design and grounded planning for intimate and multi-day weddings.",
    description:
      "Aster & Marigold develops the celebration concept, spatial plan, decor, and production schedule as one system. The team is known for restrained palettes and strong guest flow.",
    image: "/images/generated/real-wedding-feature.webp",
    imageAlt:
      "A newly married couple sharing a candid laugh after the ceremony",
    media: [
      {
        url: "/images/generated/real-wedding-feature.webp",
        alt: "A newly married couple sharing a candid laugh after the ceremony",
      },
      {
        url: "/images/generated/category-planning-decor.webp",
        alt: "Wedding planners preparing an ivory and marigold ceremony setting",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 240000,
    priceUnit: "per event",
    tags: ["Concept design", "Production", "Multi-day events"],
    yearsInBusiness: 6,
    responseTime: null,
  },
  {
    slug: "copper-tadka",
    name: "Copper Tadka",
    categorySlug: "caterers",
    citySlug: "pune",
    locality: "Koregaon Park",
    summary:
      "Contemporary Indian menus, live counters, and polished service for modern weddings.",
    description:
      "Copper Tadka builds menus around regional flavours, seasonal ingredients, and smooth guest service. Tastings, live counters, plated dinners, and vegetarian-only kitchens are available.",
    image: "/images/generated/category-catering.webp",
    imageAlt: "A wedding chef plating a contemporary Indian dish",
    media: [
      {
        url: "/images/generated/category-catering.webp",
        alt: "A wedding chef plating a contemporary Indian dish",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 2100,
    priceUnit: "per plate",
    tags: ["Menu tasting", "Live counters", "Vegetarian kitchen"],
    yearsInBusiness: 12,
    responseTime: null,
  },
  {
    slug: "table-and-tamarind",
    name: "Table & Tamarind",
    categorySlug: "caterers",
    citySlug: "bengaluru",
    locality: "Whitefield",
    summary:
      "Ingredient-led wedding catering with regional menus and precise modern presentation.",
    description:
      "Table & Tamarind offers menu design, tasting sessions, kitchen logistics, and service teams. Packages range from intimate plated dinners to large-format celebration counters.",
    image: "/images/generated/hero-celebration.webp",
    imageAlt: "A couple walking beneath a marigold canopy as guests celebrate",
    media: [
      {
        url: "/images/generated/hero-celebration.webp",
        alt: "A couple walking beneath a marigold canopy as guests celebrate",
      },
      {
        url: "/images/generated/category-catering.webp",
        alt: "A wedding chef plating a contemporary Indian dish",
      },
    ],
    rating: null,
    reviewCount: 0,
    verified: false,
    startingPrice: 2400,
    priceUnit: "per plate",
    tags: ["Regional menus", "Plated dinner", "Live service"],
    yearsInBusiness: 8,
    responseTime: null,
  },
] as const satisfies readonly PublicVendor[];
