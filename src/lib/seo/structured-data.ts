import { siteConfig } from "@/config/site";
import { isPreviewVendor, type PublicVendor } from "@/domain/marketplace";

/**
 * JSON-LD builders.
 *
 * Two rules run through all of them:
 *
 * 1. **Never emit structured data for a preview fixture.** Marking a fictional
 *    business up as a `LocalBusiness` asks Google to index an invented company.
 * 2. **Never emit `aggregateRating` without real reviews.** Google's policy
 *    requires the rating to be visible on the page and genuine; a zero-review
 *    listing must simply omit it rather than claim 0.
 */

type JsonLd = Record<string, unknown>;

const PRICE_UNIT_LABEL: Record<string, string> = {
  "on request": "on request",
  package: "per package",
  "per day": "per day",
  "per event": "per event",
  "per function": "per function",
  "per plate": "per plate",
};

/**
 * Closest real schema.org type for each launch category.
 *
 * schema.org has no "Photographer" or "MakeupArtist" business type, so those
 * fall back to `ProfessionalService` rather than inventing one — an unknown
 * @type is silently ignored by Google and wastes the markup.
 */
function businessType(categorySlug: string): string | null {
  switch (categorySlug) {
    // Every venue subtype is a venue. Omitting them would silently drop the
    // structured data from the pages most likely to be searched for by name.
    case "venues":
    case "banquet-halls":
    case "marriage-lawns":
    case "wedding-resorts":
    case "small-function-halls":
    case "destination-venues":
    case "kalyana-mandapams":
    case "wedding-hotels":
    case "luxury-hotels":
    case "farmhouses":
      return "EventVenue";
    case "caterers":
    case "bartenders":
      return "FoodEstablishment";
    case "wedding-cakes":
      return "Bakery";
    // Retail: a shop, not a service booked for the day.
    case "bridal-wear":
    case "groom-wear":
    case "accessories":
      return "ClothingStore";
    case "jewellery":
      return "JewelryStore";
    case "invitations":
    case "wedding-favours":
    case "trousseau-packers":
      return "Store";
    case "beauty-and-wellness":
      return "BeautySalon";
    case "photographers":
    case "pre-wedding-photographers":
    case "makeup-artists":
    case "family-makeup":
    case "wedding-planners":
    case "decorators":
    case "mehendi-artists":
    case "djs":
    case "sangeet-choreographers":
    case "wedding-entertainment":
    case "pandits":
      return "ProfessionalService";
    default:
      return null;
  }
}

export function vendorJsonLd(
  vendor: PublicVendor,
  options: { cityName?: string; categoryName?: string } = {},
): JsonLd | null {
  if (isPreviewVendor(vendor)) return null;

  const url = `${siteConfig.url}/vendor/${vendor.slug}`;
  const type = businessType(vendor.categorySlug);

  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": type ? ["LocalBusiness", type] : "LocalBusiness",
    "@id": url,
    name: vendor.name,
    description: vendor.summary,
    url,
    image: vendor.media.slice(0, 6).map((item) => item.url),
    address: {
      "@type": "PostalAddress",
      addressLocality: vendor.locality,
      addressRegion: options.cityName ?? vendor.citySlug,
      addressCountry: "IN",
    },
    areaServed: options.cityName
      ? { "@type": "City", name: options.cityName }
      : undefined,
    // Contact details are deliberately absent. They are released only through
    // an audited enquiry, so publishing them in JSON-LD would defeat the
    // entire privacy model.
  };

  if (vendor.rating !== null && vendor.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: vendor.rating,
      reviewCount: vendor.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (vendor.startingPrice !== null && vendor.startingPrice > 0) {
    data.makesOffer = {
      "@type": "Offer",
      priceCurrency: "INR",
      price: vendor.startingPrice,
      description: `Starting from, ${PRICE_UNIT_LABEL[vendor.priceUnit] ?? vendor.priceUnit}`,
      availability: "https://schema.org/InStock",
      category: options.categoryName ?? vendor.categorySlug,
    };
  }

  return data;
}

export function breadcrumbJsonLd(
  trail: ReadonlyArray<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${siteConfig.url}${crumb.path}`,
    })),
  };
}

/**
 * An `ItemList` for a city/category page — the markup that produces a
 * "Top 10 …" style rich result. Preview fixtures are filtered out.
 */
export function directoryJsonLd(input: {
  categoryName: string;
  cityName: string;
  path: string;
  vendors: readonly PublicVendor[];
}): JsonLd | null {
  const live = input.vendors.filter((vendor) => !isPreviewVendor(vendor));
  if (live.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${input.categoryName} in ${input.cityName}`,
    numberOfItems: live.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    url: `${siteConfig.url}${input.path}`,
    itemListElement: live.slice(0, 20).map((vendor, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteConfig.url}/vendor/${vendor.slug}`,
      name: vendor.name,
    })),
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    areaServed: { "@type": "Country", name: "India" },
  };
}

/**
 * SEO title patterns.
 *
 * "Top 12 Wedding Photographers in Jaipur" only when there really are 12.
 * Below the threshold it falls back to a plain descriptive title rather than
 * promising a list that does not exist.
 */
export function directoryTitle(input: {
  categoryName: string;
  cityName: string;
  total: number;
}) {
  if (input.total >= 5) {
    return `Top ${input.total} ${input.categoryName} in ${input.cityName}`;
  }
  return `${input.categoryName} in ${input.cityName}`;
}

export function directoryDescription(input: {
  categoryName: string;
  cityName: string;
  minPrice: number | null;
  total: number;
}) {
  const lead =
    input.total >= 5
      ? `Compare ${input.total} verified ${input.categoryName.toLocaleLowerCase("en-IN")} in ${input.cityName}.`
      : `Find ${input.categoryName.toLocaleLowerCase("en-IN")} in ${input.cityName}.`;

  const price =
    input.minPrice && input.minPrice > 0
      ? ` Starting from ₹${input.minPrice.toLocaleString("en-IN")}.`
      : "";

  return `${lead}${price} See real photos, transparent starting prices and reviews from customers who actually enquired. Contact details stay private until you send an enquiry.`;
}
