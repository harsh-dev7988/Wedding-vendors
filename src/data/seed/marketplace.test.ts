import { describe, expect, it } from "vitest";

import { launchCategories } from "../../config/categories";
import { isPreviewVendor } from "../../domain/marketplace";

import { metros, vendors } from "./marketplace";

function duplicates(values: readonly string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("marketplace seed contract", () => {
  it("uses unique, URL-safe slugs", () => {
    expect(duplicates(metros.map(({ slug }) => slug))).toEqual([]);
    expect(duplicates(launchCategories.map(({ slug }) => slug))).toEqual([]);
    expect(duplicates(vendors.map(({ slug }) => slug))).toEqual([]);

    for (const slug of [
      ...metros.map(({ slug }) => slug),
      ...launchCategories.map(({ slug }) => slug),
      ...vendors.map(({ slug }) => slug),
    ]) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("references only known metros and categories", () => {
    const citySlugs = new Set(metros.map(({ slug }) => slug));
    const categorySlugs = new Set(launchCategories.map(({ slug }) => slug));

    for (const vendor of vendors) {
      expect(citySlugs.has(vendor.citySlug)).toBe(true);
      expect(categorySlugs.has(vendor.categorySlug)).toBe(true);
      expect(vendor.startingPrice ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("makes no trust claims about fictional businesses", () => {
    // Ratings, review counts, verification and response times are claims about
    // a named business. Inventing them for a design fixture put fabricated
    // trust signals on a public page.
    for (const vendor of vendors) {
      expect(vendor.rating).toBeNull();
      expect(vendor.reviewCount).toBe(0);
      expect(vendor.verified).toBe(false);
      expect(vendor.responseTime).toBeNull();
    }
  });

  it("cannot transact: no fixture carries a listing id", () => {
    // `listingId` is the single gate for shortlisting, enquiries, reveals and
    // reviews. Its absence is what makes preview listings inert.
    for (const vendor of vendors) {
      expect("listingId" in vendor).toBe(false);
      expect(isPreviewVendor(vendor)).toBe(true);
    }
  });

  it("gives adjacent listings in a category distinct imagery", () => {
    for (const category of launchCategories) {
      const images = vendors
        .filter((vendor) => vendor.categorySlug === category.slug)
        .map((vendor) => vendor.image);
      expect(duplicates(images)).toEqual([]);
    }
  });

  it("carries no contact-shaped value in the public payload", () => {
    const payload = JSON.stringify(vendors);

    // Structural: the public DTO has no contact fields at all.
    for (const key of ["phone", "email", "whatsapp", "contact", "mobile"]) {
      expect(payload.toLowerCase()).not.toContain(`"${key}"`);
    }

    // Value-level: no Indian mobile number or email address anywhere in the
    // serialised fixture, whatever the field happens to be called.
    expect(payload).not.toMatch(/\+?91[-\s]?[6-9]\d{9}/);
    expect(payload).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(payload).not.toMatch(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    );
  });
});
