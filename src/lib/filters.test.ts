import { describe, expect, it } from "vitest";

import { DEFAULT_SORT, filterHref, serializeFilters } from "./filters";
import { MAX_PAGE, parsePage } from "./pagination";

describe("serializeFilters", () => {
  it("encodes verifiedOnly as the '1' the parser accepts", () => {
    // Regression: chip links used String(true) -> "verifiedOnly=true", which
    // the page parser (=== "1") read as false, so removing any other chip
    // silently dropped the verified filter too.
    expect(serializeFilters({ verifiedOnly: true }).get("verifiedOnly")).toBe(
      "1",
    );
  });

  it("omits verifiedOnly when false", () => {
    expect(serializeFilters({ verifiedOnly: false }).has("verifiedOnly")).toBe(
      false,
    );
  });

  it("keeps every other filter when one is removed", () => {
    const href = filterHref(
      "/vendors",
      { minPrice: 1000, minRating: 4, verifiedOnly: true },
      ["minPrice", "maxPrice"],
    );
    expect(href).toBe("/vendors?minRating=4&verifiedOnly=1");
  });

  it("leaves implicit defaults out of the URL", () => {
    expect(filterHref("/vendors", { page: 1, sort: DEFAULT_SORT })).toBe(
      "/vendors",
    );
    expect(filterHref("/vendors", { page: 2, sort: "rating" })).toBe(
      "/vendors?sort=rating&page=2",
    );
  });

  it("drops empty strings rather than emitting bare keys", () => {
    expect(filterHref("/vendors", { city: "", pincode: "", q: "" })).toBe(
      "/vendors",
    );
  });
});

describe("parsePage", () => {
  it("rejects the values a hand-edited URL can carry", () => {
    // Number("1e999") is Infinity, which survives Math.max(1, …) and then
    // turns a range offset into Infinity or NaN.
    expect(parsePage("1e999")).toBe(1);
    expect(parsePage("Infinity")).toBe(1);
    expect(parsePage("NaN")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("clamps beyond the last servable page", () => {
    // PostgREST answers an out-of-range .range() with 416 and a null count,
    // which renders as "nothing here" rather than "past the end".
    expect(parsePage("999999999")).toBe(MAX_PAGE);
    expect(parsePage(String(MAX_PAGE + 1))).toBe(MAX_PAGE);
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parsePage(["3", "9"])).toBe(3);
  });

  it("passes ordinary pages through", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("7")).toBe(7);
  });
});
