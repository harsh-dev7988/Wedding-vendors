/**
 * Builds a URL for Next's built-in image optimizer.
 *
 * `next/image` normally does this for you. The hero needs it by hand because
 * art direction happens in a `<picture>`: the portrait `<source>` is chosen by
 * the browser, not by React, so nothing generates a srcset for it and the raw
 * file would be served unoptimised to exactly the devices least able to afford
 * it.
 *
 * The query shape is the optimizer's public contract — it is what `next/image`
 * itself emits and what `images.remotePatterns` and custom loaders are written
 * against.
 */
export function nextImageUrl(src: string, width: number, quality: number) {
  // Parameter order matches what next/image emits, so the two share a CDN
  // cache key for the same rendition instead of storing it twice.
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

/**
 * A `srcset` covering the device widths that can actually match a query.
 *
 * These are Next's own default `deviceSizes` entries below 828px, which is the
 * widest a phone in portrait reports.
 */
export function nextImageSrcSet(
  src: string,
  widths: readonly number[],
  quality: number,
) {
  return widths
    .map((width) => `${nextImageUrl(src, width, quality)} ${width}w`)
    .join(", ");
}
