import { describe, expect, it } from "vitest";

import { normalizeIndianPhone } from "./phone";

describe("normalizeIndianPhone", () => {
  it("normalizes Indian mobile numbers", () => {
    expect(normalizeIndianPhone("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("91-98765-43210")).toBe("+919876543210");
  });

  it("retains valid international E.164 numbers", () => {
    expect(normalizeIndianPhone("+44 7700 900123")).toBe("+447700900123");
  });

  it("rejects malformed numbers", () => {
    expect(normalizeIndianPhone("12345")).toBeNull();
  });
});
