/**
 * Highest page any list will serve.
 *
 * PostgREST answers an out-of-range `.range()` with 416 and a null count, which
 * the pages render as "nothing here" — indistinguishable from an empty result.
 * Clamping keeps a hand-edited `?page=` inside the range where that cannot
 * happen, and the deep pages beyond it were never reachable through the UI.
 */
export const MAX_PAGE = 500;

/**
 * Reads a `page` query parameter as a positive integer.
 *
 * `Number("1e999")` is `Infinity`, which survives a `Math.max(1, …)` guard and
 * then turns an offset into `Infinity` or `NaN`. Parsing with a radix and
 * requiring a finite result rejects that, along with `"abc"`, `"-1"` and `"0"`.
 */
export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}
