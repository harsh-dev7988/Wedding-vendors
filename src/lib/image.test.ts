import { describe, expect, it } from "vitest";

import { sniffImageType } from "./image";

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
