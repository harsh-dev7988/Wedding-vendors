"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { publishableKey, url } = getSupabasePublicEnv();

  return createBrowserClient(url, publishableKey);
}
