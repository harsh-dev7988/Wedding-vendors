import "server-only";

import sharp from "sharp";

import {
  IMAGE_VARIANTS,
  STORED_IMAGE_CONTENT_TYPE,
  type ImageVariant,
} from "./image";

/**
 * A phone photo carries EXIF, and EXIF carries GPS. Storing the uploaded bytes
 * verbatim in a public bucket therefore published the coordinates of wherever
 * the vendor took the picture — usually their studio or their home — at a URL
 * anyone could fetch. That is the exact disclosure the contact-privacy model
 * exists to prevent, so the bytes are re-encoded here rather than passed
 * through.
 *
 * Re-encoding is the whole defence: sharp emits a fresh file from decoded
 * pixels, so EXIF, XMP, IPTC and any appended payload are gone by
 * construction. A client-side strip could not do this job — the Server Action
 * accepts whatever bytes arrive on the wire, not whatever the form sent.
 */

/** Decompression-bomb guard: ~50 MP, comfortably above any real camera. */
const MAX_INPUT_PIXELS = 50_000_000;

export type ProcessedImage = {
  readonly bytes: Uint8Array;
  readonly variant: ImageVariant;
};

export type ProcessedUpload = {
  readonly contentType: string;
  readonly height: number;
  readonly variants: readonly ProcessedImage[];
  readonly width: number;
};

/**
 * Re-encode one upload into every rendered size.
 *
 * Returns `null` for anything sharp cannot decode, which covers truncated
 * files and the case where the magic bytes were forged to pass `sniffImageType`
 * but the payload is not really an image.
 */
export async function processUpload(
  input: Uint8Array,
): Promise<ProcessedUpload | null> {
  let width: number;
  let height: number;

  try {
    const probe = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).metadata();
    // `autoOrient` is the size after the EXIF orientation tag is applied, which
    // is how the picture will actually be displayed. The raw width and height
    // describe the sensor, so a portrait phone photo reports as landscape.
    const displayed = probe.autoOrient ?? probe;
    if (!displayed.width || !displayed.height) return null;
    width = displayed.width;
    height = displayed.height;
  } catch {
    return null;
  }

  try {
    const variants = await Promise.all(
      (Object.keys(IMAGE_VARIANTS) as ImageVariant[]).map(async (variant) => ({
        bytes: new Uint8Array(
          await sharp(input, {
            limitInputPixels: MAX_INPUT_PIXELS,
            sequentialRead: true,
          })
            // Bakes the EXIF orientation into the pixels first; without it,
            // dropping the tag would silently turn portrait shots sideways.
            .rotate()
            .resize({
              fit: "inside",
              width: IMAGE_VARIANTS[variant],
              withoutEnlargement: true,
            })
            // The ICC profile goes with the rest of the metadata, so convert
            // rather than let a wide-gamut original be reinterpreted as sRGB.
            .toColourspace("srgb")
            .webp({ effort: 4, quality: variant === "thumb" ? 72 : 82 })
            .toBuffer(),
        ),
        variant,
      })),
    );

    return { contentType: STORED_IMAGE_CONTENT_TYPE, height, variants, width };
  } catch {
    return null;
  }
}
