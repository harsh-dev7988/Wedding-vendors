import type { PriceUnit } from "@/domain/marketplace";

export function formatIndianPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * A listing with no published price is a first-class state — `price_unit`
 * defaults to `on_request` precisely to express it. Rendering `₹0` read as
 * "free", so a null price never reaches the currency formatter.
 */
export function formatStartingPrice(
  value: number | null,
  unit: PriceUnit,
): { amount: string; unit: string | null } {
  if (value === null || value <= 0 || unit === "on request") {
    return { amount: "Price on request", unit: null };
  }
  return { amount: formatIndianPrice(value), unit };
}

export function formatReviewCount(count: number) {
  if (count === 0) return "No reviews yet";
  return `${count} ${count === 1 ? "review" : "reviews"}`;
}

export function formatYearsInBusiness(years: number) {
  if (years <= 0) return "Newly listed";
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/**
 * A response-time claim, derived from real first replies.
 *
 * Returns null below a minimum sample so a single fast reply cannot advertise
 * "usually responds in 5 minutes". The profile simply omits the stat instead.
 */
export function formatResponseTime(
  minutes: number | null,
  sampleSize: number,
): string | null {
  if (minutes === null || sampleSize < 3) return null;
  if (minutes < 60) return `Usually responds in under an hour`;
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return `Usually responds in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = Math.round(minutes / (24 * 60));
  return `Usually responds in ${days} ${days === 1 ? "day" : "days"}`;
}
