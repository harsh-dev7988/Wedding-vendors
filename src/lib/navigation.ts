const FALLBACK = "/vendors";
const INTERNAL_ORIGIN = "https://internal.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Reduce an untrusted `next` / `returnTo` value to a same-origin path.
 *
 * Browsers resolve `//host` and `/\host` (and mixed forms such as `/\/host`)
 * to an absolute URL on another origin, so a `startsWith("/")` check alone is
 * not enough — that gap produced a live open redirect on the sign-in page.
 * Backslashes are normalised to forward slashes *before* the leading-slash
 * test so every protocol-relative spelling collapses to the same shape, and
 * the result is re-parsed against a throwaway origin to reject anything that
 * still escapes.
 */
export function safeInternalPath(
  value: FormDataEntryValue | string | null | undefined,
) {
  if (typeof value !== "string") return FALLBACK;

  const candidate = value.replace(/\\/g, "/").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return FALLBACK;
  // Control characters would allow header splitting in a Location value.
  if (CONTROL_CHARACTERS.test(candidate)) return FALLBACK;

  let parsed: URL;
  try {
    parsed = new URL(candidate, INTERNAL_ORIGIN);
  } catch {
    return FALLBACK;
  }

  if (parsed.origin !== INTERNAL_ORIGIN) return FALLBACK;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Append query parameters to a path that may already carry a query string. */
export function withQuery(
  path: string,
  params: Record<string, string | undefined>,
) {
  const url = new URL(safeInternalPath(path), INTERNAL_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
