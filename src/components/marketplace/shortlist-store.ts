"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

type Listener = (ids: ReadonlySet<string>) => void;

let cache: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;
const listeners = new Set<Listener>();

function emit() {
  const snapshot: ReadonlySet<string> = cache ?? new Set<string>();
  for (const listener of listeners) listener(snapshot);
}

/**
 * The viewer's shortlisted listing ids, fetched once per page load.
 *
 * Reading this on the server would mean `cookies()` in the directory render,
 * which would opt the prerendered city/category routes back into dynamic
 * rendering. One client query, shared by every card, keeps those routes static
 * while still letting each heart show real state.
 */
export function loadShortlist(): Promise<Set<string>> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  if (!isSupabaseConfigured()) {
    cache = new Set();
    return Promise.resolve(cache);
  }

  const request = (async () => {
    let ids = new Set<string>();
    try {
      const { data } = await createClient()
        .from("shortlists")
        .select("listing_id");
      ids = new Set((data ?? []).map((row) => row.listing_id as string));
    } catch {
      // A signed-out or offline viewer simply has no saved listings.
    }
    cache = ids;
    inFlight = null;
    emit();
    return ids;
  })();

  inFlight = request;
  return request;
}

/** Optimistic local update so the icon responds before the round trip. */
export function setShortlisted(listingId: string, shortlisted: boolean) {
  cache = new Set(cache ?? []);
  if (shortlisted) cache.add(listingId);
  else cache.delete(listingId);
  emit();
}

export function subscribeToShortlist(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
