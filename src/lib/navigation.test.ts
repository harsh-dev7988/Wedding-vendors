import { describe, expect, it } from "vitest";

import { safeInternalPath, withQuery } from "./navigation";

describe("safeInternalPath", () => {
  it("keeps genuine internal paths intact", () => {
    expect(safeInternalPath("/shortlist")).toBe("/shortlist");
    expect(safeInternalPath("/vendors?city=mumbai")).toBe(
      "/vendors?city=mumbai",
    );
    expect(safeInternalPath("/vendor/a-b#reviews")).toBe("/vendor/a-b#reviews");
  });

  it("rejects protocol-relative and backslash open-redirect payloads", () => {
    // Browsers resolve every one of these to another origin.
    expect(safeInternalPath("//evil.example.com")).toBe("/vendors"); // protocol-relative
    expect(safeInternalPath("/\\evil.example.com")).toBe("/vendors"); // backslash
    expect(safeInternalPath("/\\/evil.example.com")).toBe("/vendors"); // mixed slash
    expect(safeInternalPath("\\\\evil.example.com")).toBe("/vendors"); // double backslash
    expect(safeInternalPath("///evil.example.com")).toBe("/vendors"); // triple slash
  });

  it("rejects absolute URLs and non-path schemes", () => {
    expect(safeInternalPath("https://evil.example.com")).toBe("/vendors");
    expect(safeInternalPath("http://evil.example.com")).toBe("/vendors");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/vendors");
    expect(safeInternalPath("data:text/html,<script>")).toBe("/vendors");
  });

  it("rejects control characters that could split a Location header", () => {
    expect(safeInternalPath("/vendors\nLocation: https://evil.example")).toBe(
      "/vendors",
    );
    expect(safeInternalPath("/vendors\r\nSet-Cookie: a=b")).toBe("/vendors");
  });

  it("rejects non-string and relative input", () => {
    expect(safeInternalPath(null)).toBe("/vendors");
    expect(safeInternalPath(undefined)).toBe("/vendors");
    expect(safeInternalPath("vendors")).toBe("/vendors");
    expect(safeInternalPath("")).toBe("/vendors");
  });
});

describe("withQuery", () => {
  it("appends to a path that already has a query string", () => {
    expect(withQuery("/vendors?city=pune", { shortlist: "saved" })).toBe(
      "/vendors?city=pune&shortlist=saved",
    );
  });

  it("adds a query string to a bare path", () => {
    expect(withQuery("/vendor/a-b", { shortlist: "saved" })).toBe(
      "/vendor/a-b?shortlist=saved",
    );
  });

  it("skips undefined values and sanitises the base path", () => {
    expect(withQuery("/vendors", { a: undefined, b: "1" })).toBe(
      "/vendors?b=1",
    );
    expect(withQuery("//evil.example", { b: "1" })).toBe("/vendors?b=1");
  });
});
