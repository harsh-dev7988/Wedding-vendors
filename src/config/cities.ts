/**
 * Per-city banner photography.
 *
 * Deliberately separate from the cities table, for the same reason
 * `CATEGORY_MEDIA` is separate from `categories`: a row should carry what the
 * product reasons about, not which file happens to illustrate it.
 *
 * A city without an entry falls back to a shared wedding scene. That is the
 * honest default — a stock skyline captioned "Delhi NCR" would be worse than a
 * warm image that makes no claim about place — and it means a city added in
 * Supabase gets a working banner the moment it exists, with no deploy.
 */
export const CITY_BANNER_FALLBACK = {
  image: "/images/generated/hero-celebration.webp",
  imageAlt: "",
} as const;

export type CityMedia = {
  readonly image: string;
  /** Empty when the image is decorative — the heading already names the city. */
  readonly imageAlt: string;
};

export const CITY_MEDIA: Readonly<Record<string, CityMedia>> = {};

export function cityBanner(slug: string): CityMedia {
  return CITY_MEDIA[slug] ?? CITY_BANNER_FALLBACK;
}
