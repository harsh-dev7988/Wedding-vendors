import { IMAGE_VARIANTS, STORED_IMAGE_CONTENT_TYPE } from "./image";

/**
 * Shrinks a picked file in the browser before it is sent to the Server Action.
 *
 * This is a bandwidth courtesy, not a security control — the server re-encodes
 * whatever bytes arrive, because a Server Action cannot trust that the file it
 * receives is the one this function produced. See lib/image-pipeline.ts.
 *
 * Returns `null` whenever the original should be sent unchanged: an
 * unsupported browser, a decode failure, or a re-encode that came out bigger
 * than the file we started with.
 */

/** Below this, the round trip costs more than it saves. */
const MIN_BYTES_TO_BOTHER = 600 * 1024;

export async function compressForUpload(file: File): Promise<File | null> {
  if (file.size <= MIN_BYTES_TO_BOTHER) return null;
  if (typeof createImageBitmap !== "function") return null;

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF orientation while decoding, so a portrait
    // phone photo does not arrive sideways once the tag is dropped.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(
      1,
      IMAGE_VARIANTS.full / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, STORED_IMAGE_CONTENT_TYPE, 0.85);
    });

    // Older Safari silently ignores the WebP request and hands back a PNG,
    // which is routinely larger than the JPEG we were given.
    if (!blob || blob.size >= file.size) return null;
    if (blob.type !== STORED_IMAGE_CONTENT_TYPE) return null;

    return new File([blob], `${stripExtension(file.name)}.webp`, {
      lastModified: file.lastModified,
      type: STORED_IMAGE_CONTENT_TYPE,
    });
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

function stripExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
