import { describe, expect, it } from "vitest";

import {
  DEFAULT_SERVICE_RADIUS_M,
  defaultServiceRadiusM,
  formatDistance,
  formatServiceRadius,
  isFixedLocationCategory,
  isPlausibleIndianCoordinate,
} from "./geo";

describe("service radius by category", () => {
  it("gives a venue no radius", () => {
    // A venue is a place you travel to. Asking how far it travels is a
    // category error, and a non-null radius would make it match by the wrong
    // rule in search_listings.
    expect(isFixedLocationCategory("venues")).toBe(true);
    expect(defaultServiceRadiusM("venues")).toBeNull();
  });

  it("gives every mobile category 30 km", () => {
    for (const slug of [
      "photographers",
      "makeup-artists",
      "caterers",
      "planners-decorators",
    ]) {
      expect(defaultServiceRadiusM(slug)).toBe(DEFAULT_SERVICE_RADIUS_M);
    }
  });
});

describe("isPlausibleIndianCoordinate", () => {
  it("accepts real Indian coordinates", () => {
    expect(isPlausibleIndianCoordinate(28.6139, 77.209)).toBe(true); // Delhi
    expect(isPlausibleIndianCoordinate(9.9312, 76.2673)).toBe(true); // Kochi
  });

  it("rejects a transposed pair", () => {
    // 77.209, 28.6139 is the same numbers the wrong way round — inside
    // Kazakhstan. This is the single most common coordinate bug.
    expect(isPlausibleIndianCoordinate(77.209, 28.6139)).toBe(false);
  });

  it("rejects null island and out-of-range values", () => {
    expect(isPlausibleIndianCoordinate(0, 0)).toBe(false);
    expect(isPlausibleIndianCoordinate(51.5, -0.12)).toBe(false); // London
    expect(isPlausibleIndianCoordinate(Number.NaN, 77)).toBe(false);
    expect(isPlausibleIndianCoordinate(Infinity, 77)).toBe(false);
  });
});

describe("formatDistance", () => {
  it("avoids a decimal where it reads oddly", () => {
    expect(formatDistance(0.4)).toBe("Less than a km away");
    expect(formatDistance(0)).toBe("Less than a km away");
  });

  it("formats whole and fractional distances", () => {
    expect(formatDistance(4)).toBe("4 km away");
    expect(formatDistance(4.24)).toBe("4.2 km away");
  });

  it("returns null when there is no origin to measure from", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(Number.NaN)).toBeNull();
  });
});

describe("formatServiceRadius", () => {
  it("describes a mobile vendor's reach", () => {
    expect(formatServiceRadius(30000)).toBe("Travels up to 30 km");
    expect(formatServiceRadius(7500)).toBe("Travels up to 8 km");
  });

  it("says nothing for a fixed location", () => {
    expect(formatServiceRadius(null)).toBeNull();
    expect(formatServiceRadius(undefined)).toBeNull();
  });
});
