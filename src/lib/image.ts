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
