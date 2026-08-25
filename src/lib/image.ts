export const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SniffResult = { contentType: string; extension: string } | null;

/**
 * Identify an image from its bytes rather than its declared MIME type.
 *
 * `File.type` is set by the browser from the file name and is fully
 * attacker-controlled; Supabase Storage's `allowed_mime_types` validates the
 * same client-supplied header. Sniffing the magic bytes is the only check that
 * an uploaded file is actually the image it claims to be.
 */
export function sniffImageType(bytes: Uint8Array): SniffResult {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return { contentType: "image/png", extension: "png" };
  }

  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

/**
 * Rendered sizes. Every upload is re-encoded into all three, so a directory
 * card never has to download a 5 MB original to fill a 400 px slot.
 */
export const IMAGE_VARIANTS = {
  card: 800,
  full: 2000,
  thumb: 400,
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

/** Extension every stored object uses once it has been through the pipeline. */
export const STORED_IMAGE_EXTENSION = "webp";
export const STORED_IMAGE_CONTENT_TYPE = "image/webp";

/**
 * Storage key for one variant of a stored image.
 *
 * `listing_media.storage_path` holds the full-size key; the smaller renditions
 * live beside it under a suffix. Anything that predates the pipeline is still
 * a `.jpg` or `.png` with no siblings on disk, so those paths are returned
 * unchanged rather than pointing at an object that was never written.
 */
export function variantPath(storagePath: string, variant: ImageVariant) {
  const suffix = `.${STORED_IMAGE_EXTENSION}`;
  if (variant === "full") return storagePath;
  if (!storagePath.endsWith(suffix)) return storagePath;
  return `${storagePath.slice(0, -suffix.length)}-${variant}${suffix}`;
}

/**
 * Every object one stored image occupies, de-duplicated.
 *
 * Deleting a listing image has to remove the renditions too, or the bucket
 * accumulates orphans that are still publicly fetchable. Legacy paths collapse
 * to a single entry because `variantPath` leaves them alone.
 */
export function allVariantPaths(storagePath: string) {
  const keys = Object.keys(IMAGE_VARIANTS) as ImageVariant[];
  return [...new Set(keys.map((variant) => variantPath(storagePath, variant)))];
}
