export type Metro = {
  readonly name: string;
  readonly slug: string;
  readonly region: string;
  readonly shortLabel: string;
};

export type PriceUnit =
  | "per plate"
  | "per event"
  | "per function"
  | "per day"
  | "package"
  | "on request";

export type VendorMedia = {
  readonly url: string;
  readonly alt: string;
};

export type PublicReview = {
  readonly id: string;
  readonly rating: number;
  readonly body: string;
  readonly createdAt: string;
  readonly vendorReply: string | null;
};

/**
 * The public shape of a listing.
 *
 * This type deliberately has no phone, email or WhatsApp field. Contact
 * details are released only by `submit_enquiry_and_reveal` /
 * `get_revealed_contact` and are never carried on a public DTO, so the
 * mistake is unrepresentable rather than merely avoided.
 */
export type PublicVendor = {
  readonly listingId?: string;
  readonly slug: string;
  readonly name: string;
  readonly categorySlug: string;
  readonly citySlug: string;
  readonly locality: string;
  readonly summary: string;
  readonly description: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly media: readonly VendorMedia[];
  readonly rating: number | null;
  readonly reviewCount: number;
  readonly verified: boolean;
  readonly startingPrice: number | null;
  readonly priceUnit: PriceUnit;
  readonly tags: readonly string[];
  readonly yearsInBusiness: number;
  readonly responseTime: string | null;
  readonly vendorId?: string;
  /** Only set when the search supplied a pincode origin. */
  readonly distanceKm?: number | null;
  /** How far this business travels, in metres. Null means a fixed location —
   *  a venue is somewhere you go to. */
  readonly serviceRadiusM?: number | null;
};

/** Preview fixtures never carry a listing id, so they can never transact. */
export function isPreviewVendor(vendor: PublicVendor) {
  return !vendor.listingId;
}

export type VendorSort =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "experience"
  | "response"
  | "distance";

export type VendorSearch = {
  readonly city?: string;
  readonly category?: string;
  /**
   * Restrict to venues, or to everything that is not a venue.
   *
   * The vendor directory and the venue section are different products sharing
   * one table; this is the line between them. Left unset it means "both",
   * which is only correct for a search that genuinely spans the two.
   */
  readonly kind?: "venue" | "service";
  readonly query?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly minRating?: number;
  readonly verifiedOnly?: boolean;
  readonly pincode?: string;
  /** An explicit search origin, from browser geolocation. Beats `pincode`,
   *  which can only ever be a postcode centroid. */
  readonly originLat?: number;
  readonly originLng?: number;
  readonly radiusKm?: number;
  readonly sort?: VendorSort;
};

export type VendorSearchResult = {
  readonly vendors: readonly PublicVendor[];
  readonly total: number;
};
