import { describe, expect, it } from "vitest";

import { allVariantPaths, sniffImageType, variantPath } from "./image";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const webp = new Uint8Array([
  ...[0x52, 0x49, 0x46, 0x46], // RIFF
  ...[0, 0, 0, 0],
  ...[0x57, 0x45, 0x42, 0x50], // WEBP
]);

describe("sniffImageType", () => {
  it("identifies the three permitted formats from their magic bytes", () => {
    expect(sniffImageType(jpeg)).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(sniffImageType(png)).toEqual({
      contentType: "image/png",
      extension: "png",
    });
    expect(sniffImageType(webp)).toEqual({
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("rejects a non-image renamed to look like one", () => {
    // `File.type` is derived from the filename and is attacker-controlled, so
    // the bytes are the only trustworthy signal.
    const html = new TextEncoder().encode("<!doctype html><script>x</script>");
    expect(sniffImageType(html)).toBeNull();

    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000">',
    );
    expect(sniffImageType(svg)).toBeNull();
  });

  it("rejects truncated input", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = new Uint8Array([
      ...[0x52, 0x49, 0x46, 0x46],
      ...[0, 0, 0, 0],
      ...[0x57, 0x41, 0x56, 0x45], // WAVE
    ]);
    expect(sniffImageType(wav)).toBeNull();
  });
});

describe("variantPath", () => {
  const stored = "vendor-id/listing-id/abc.webp";

  it("leaves the full size at the stored path", () => {
    expect(variantPath(stored, "full")).toBe(stored);
  });

  it("puts renditions beside the original", () => {
    expect(variantPath(stored, "card")).toBe(
      "vendor-id/listing-id/abc-card.webp",
    );
    expect(variantPath(stored, "thumb")).toBe(
      "vendor-id/listing-id/abc-thumb.webp",
    );
  });

  it("leaves pre-pipeline paths alone", () => {
    // These were uploaded before renditions existed, so the sibling objects
    // were never written and linking to them would 404.
    expect(variantPath("v/l/abc.jpg", "card")).toBe("v/l/abc.jpg");
    expect(variantPath("v/l/abc.png", "thumb")).toBe("v/l/abc.png");
  });

  it("does not treat the extension dot as a wildcard", () => {
    expect(variantPath("v/l/abcxwebp", "card")).toBe("v/l/abcxwebp");
  });
});

describe("allVariantPaths", () => {
  it("lists every object a stored image occupies", () => {
    expect(allVariantPaths("v/l/abc.webp").sort()).toEqual([
      "v/l/abc-card.webp",
      "v/l/abc-thumb.webp",
      "v/l/abc.webp",
    ]);
  });

  it("collapses to one entry for a pre-pipeline path", () => {
    expect(allVariantPaths("v/l/abc.jpg")).toEqual(["v/l/abc.jpg"]);
  });
});
