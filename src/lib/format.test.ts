import { describe, expect, it } from "vitest";

import { formatResponseTime, formatStartingPrice } from "./format";

describe("formatResponseTime", () => {
  it("stays silent below a meaningful sample", () => {
    // One fast reply must not advertise "responds in under an hour".
    expect(formatResponseTime(5, 1)).toBeNull();
    expect(formatResponseTime(5, 2)).toBeNull();
    expect(formatResponseTime(null, 50)).toBeNull();
  });

  it("reports once there is enough evidence", () => {
    expect(formatResponseTime(30, 3)).toBe("Usually responds in under an hour");
    expect(formatResponseTime(120, 10)).toBe("Usually responds in 2 hours");
    expect(formatResponseTime(60, 10)).toBe("Usually responds in 1 hour");
    expect(formatResponseTime(2880, 10)).toBe("Usually responds in 2 days");
  });
});

describe("formatStartingPrice", () => {
  it("never renders a zero price as free", () => {
    expect(formatStartingPrice(null, "per plate").amount).toBe(
      "Price on request",
    );
    expect(formatStartingPrice(0, "per plate").amount).toBe("Price on request");
    expect(formatStartingPrice(5000, "on request").amount).toBe(
      "Price on request",
    );
  });

  it("formats real prices in Indian notation", () => {
    const price = formatStartingPrice(285000, "per event");
    expect(price.amount).toContain("2,85,000");
    expect(price.unit).toBe("per event");
  });
});
