import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { processUpload } from "./image-pipeline";

/**
 * A JPEG carrying the kind of EXIF a phone camera writes, including GPS.
 * Built rather than committed as a fixture so the assertion below is testing
 * the stripper, not a stale binary.
 */
async function jpegWithGps() {
  return sharp({
    create: {
      background: { b: 40, g: 120, r: 220 },
      channels: 3,
      height: 900,
      width: 1200,
    },
  })
    .withExif({
      IFD0: { Artist: "Studio Name", Copyright: "Studio Name" },
      IFD3: {
        GPSLatitude: "19/1 4/1 0/1",
        GPSLatitudeRef: "N",
        GPSLongitude: "72/1 52/1 0/1",
        GPSLongitudeRef: "E",
      },
    })
    .jpeg()
    .toBuffer();
}

describe("processUpload", () => {
  let original: Buffer;

  beforeAll(async () => {
    original = await jpegWithGps();
  });

  it("the fixture really does carry GPS, or the test below proves nothing", async () => {
    const meta = await sharp(original).metadata();
    expect(meta.exif).toBeDefined();
    expect(meta.exif!.toString("latin1")).toContain("Studio Name");
  });

  it("strips EXIF, GPS and every other metadata block", async () => {
    const result = await processUpload(new Uint8Array(original));
    expect(result).not.toBeNull();

    for (const rendition of result!.variants) {
      const meta = await sharp(rendition.bytes).metadata();
      expect(meta.exif, `${rendition.variant} kept EXIF`).toBeUndefined();
      expect(meta.xmp, `${rendition.variant} kept XMP`).toBeUndefined();
      expect(meta.iptc, `${rendition.variant} kept IPTC`).toBeUndefined();
      // Belt and braces: no GPS marker survives anywhere in the bytes.
      const raw = Buffer.from(rendition.bytes).toString("latin1");
      expect(raw).not.toContain("GPS");
      expect(raw).not.toContain("Studio Name");
    }
  });

  it("emits all three renditions, none larger than its target", async () => {
    const result = await processUpload(new Uint8Array(original));
    const sizes: Record<string, number> = {};
    for (const rendition of result!.variants) {
      const meta = await sharp(rendition.bytes).metadata();
      sizes[rendition.variant] = meta.width!;
      expect(meta.format).toBe("webp");
    }
    expect(sizes).toEqual({ card: 800, full: 1200, thumb: 400 });
  });

  it("reports the displayed dimensions for a rotated original", async () => {
    // Orientation 6 means "rotate 90° clockwise to display", so a 1200x900
    // sensor image is really a 900x1200 picture.
    const rotated = await sharp({
      create: {
        background: { b: 0, g: 0, r: 0 },
        channels: 3,
        height: 900,
        width: 1200,
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await processUpload(new Uint8Array(rotated));
    expect(result).not.toBeNull();
    expect([result!.width, result!.height]).toEqual([900, 1200]);
  });

  it("rejects bytes that are not a decodable image", async () => {
    // Forged JPEG magic bytes with a junk payload: enough to pass a magic-byte
    // sniff, not enough to decode.
    const forged = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(512, 0x41),
    ]);
    expect(await processUpload(new Uint8Array(forged))).toBeNull();
  });
});
