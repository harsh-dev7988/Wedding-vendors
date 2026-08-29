"use client";

/**
 * The city this visitor has shown us they care about.
 *
 * The city already lives in the URL on every indexable page, and that is the
 * real state: shareable, cacheable, unambiguous. What was missing is that
 * nothing filled it in for somebody coming back — pick Pune in the hero, land
 * on a Pune page, click "All vendors", and you are looking at all of India
 * again.
 *
 * So this decides **where links point**, never **what a page shows**. That
 * distinction is the whole design:
 *
 *   - A prerendered page must not read it while rendering. Reading a cookie on
 *     the server means `cookies()`, which opts all 375 routes into dynamic
 *     rendering — the regression this codebase has had three times.
 *   - A page whose *content* depended on it could not be shared. Send someone
 *     `/vendors/mumbai/photographers`, they have Pune remembered, and they see
 *     Pune. That breaks links, search results and the back button at once.
 *
 * An explicit URL therefore always wins. This only ever supplies a default.
 *
 * Stored twice on purpose: `localStorage` is the source of truth and survives
 * with the tab, while the cookie exists solely so the two already-dynamic
 * routes (`/vendors`, `/venues`) can preselect it server-side without a flash.
 */

import { CITY_COOKIE } from "./city-cookie";

const KEY = "wv.city";

export { CITY_COOKIE };
/** Long enough to be useful, short enough that a stale city expires on its own. */
const COOKIE_MAX_AGE_DAYS = 90;

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: string | null | undefined;

function emit() {
  for (const listener of listeners) listener();
}

/**
 * A slug shape, not a known city.
 *
 * Whether the city exists is decided by whoever reads this against the cities
 * table — the list is data and changes without a deploy, so a hardcoded set
 * here would go stale. This only refuses anything that could not be a slug,
 * which is what keeps a hand-edited cookie from carrying a payload.
 */
function clean(value: string | null | undefined) {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 64
    ? slug
    : null;
}

function writeCookie(slug: string | null) {
  if (typeof document === "undefined") return;
  const base = `${CITY_COOKIE}=`;
  document.cookie = slug
    ? `${base}${encodeURIComponent(slug)}; path=/; max-age=${
        COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
      }; samesite=lax`
    : `${base}; path=/; max-age=0; samesite=lax`;
}

/** Module-private: callers ask `shouldOfferCityPrompt`, not the raw value. */
function readCity(): string | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    cache = clean(window.localStorage.getItem(KEY));
  } catch {
    // Private browsing, or storage disabled. A forgotten city is not a failure.
    cache = null;
  }
  return cache;
}

export function setCity(slug: string | null) {
  const next = clean(slug);
  if (next === readCity()) return;
  cache = next;
  try {
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Ignored for the same reason as above.
  }
  writeCookie(next);
  emit();
}

/**
 * Subscribes to changes, for `useSyncExternalStore`.
 *
 * That hook rather than an effect that calls setState: this *is* an external
 * store, and reading it into state in an effect is the pattern
 * `react-hooks/set-state-in-effect` exists to catch. It also gets the
 * server/client split right for free — the server snapshot is always "nothing
 * remembered", which is what the prerendered HTML must contain.
 */
export function subscribeToCity(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when nothing has been remembered and nothing has been dismissed. */
export function shouldOfferCityPrompt() {
  return !readCity() && !hasDismissedCityPrompt();
}

/** The prompt is never offered in prerendered HTML, only after hydration. */
export function neverOnServer() {
  return false;
}

const DISMISSED = "wv.city.dismissed";

/** Module-private, for the same reason. */
function hasDismissedCityPrompt() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED) === "1";
  } catch {
    // Cannot remember the dismissal, so do not offer something that cannot be
    // dismissed. Silence is the safer failure.
    return true;
  }
}

export function dismissCityPrompt() {
  try {
    window.localStorage.setItem(DISMISSED, "1");
  } catch {
    // Ignored.
  }
  emit();
}
