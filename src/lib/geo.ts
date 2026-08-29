/** Default distance a mobile business will travel, in metres. */
export const DEFAULT_SERVICE_RADIUS_M = 30_000;

/** Bounds accepted by the `service_radius_m` check constraint. */
export const MIN_SERVICE_RADIUS_M = 1_000;
export const MAX_SERVICE_RADIUS_M = 200_000;

/**
 * Categories whose listings are a fixed place you travel *to*.
 *
 * A venue does not have a service radius — asking one how far it travels is a
 * category error. These listings are matched by the customer's own radius
 * instead. Everything else defaults to {@link DEFAULT_SERVICE_RADIUS_M}.
 *
 * Every venue subtype belongs here, not just the parent: a banquet hall and a
 * farmhouse are no more mobile than "venues" is. The authority is
 * `categories.kind`, and callers that hold the category row should use that
 * directly — this list exists for the places that have only a slug, and it has
 * to be kept in step with the venue rows.
 */
const FIXED_LOCATION_CATEGORIES = new Set([
  "venues",
  "banquet-halls",
  "marriage-lawns",
  "wedding-resorts",
  "small-function-halls",
  "destination-venues",
  "kalyana-mandapams",
  "wedding-hotels",
  "luxury-hotels",
  "farmhouses",
]);

export function isFixedLocationCategory(categorySlug: string) {
  return FIXED_LOCATION_CATEGORIES.has(categorySlug);
}

export function defaultServiceRadiusM(categorySlug: string) {
  return isFixedLocationCategory(categorySlug)
    ? null
    : DEFAULT_SERVICE_RADIUS_M;
}

/** India's bounding box, generously drawn. Rejects a transposed lat/lng pair. */
export function isPlausibleIndianCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 6 &&
    lat <= 37.5 &&
    lng >= 68 &&
    lng <= 97.5
  );
}

/** "4.2 km away", or "Less than a km away" where a decimal reads oddly. */
export function formatDistance(km: number | null | undefined) {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return "Less than a km away";
  return `${km % 1 === 0 ? km : km.toFixed(1)} km away`;
}

/** "Travels up to 30 km". Null for a fixed location, which says nothing. */
export function formatServiceRadius(metres: number | null | undefined) {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) {
    return null;
  }
  return `Travels up to ${Math.round(metres / 1000)} km`;
}
