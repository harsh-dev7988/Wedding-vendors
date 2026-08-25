export const INDIA_TIME_ZONE = "Asia/Kolkata";

/**
 * Today's calendar date in India, as `YYYY-MM-DD`.
 *
 * Operational timestamps stay UTC, but an event date is a calendar date in the
 * customer's country. Comparing against a UTC "today" rejected valid same-day
 * enquiries for the 5.5 hours after midnight IST.
 */
export function indiaToday(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** `2026-09-12` → `12 September 2026`. Falls back to the raw value. */
export function formatEventDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

/** An absolute instant rendered in IST, never in the server's timezone. */
export function formatIndiaDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
