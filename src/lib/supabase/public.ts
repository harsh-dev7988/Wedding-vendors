import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * A cookie-free client for public discovery data.
 *
 * The cookie-backed SSR client calls `cookies()`, which opts the entire route
 * into dynamic rendering — that silently defeated `generateStaticParams` on all
 * 60 city/category routes and every vendor profile as soon as Supabase
 * credentials existed. Published listings are readable by `anon` under RLS, so
 * public reads never need a session, and using this client keeps those routes
 * prerenderable and cacheable.
 *
 * Never use this for anything a signed-in user owns: it has no session, so RLS
 * evaluates it as `anon`.
 */
export function createPublicClient() {
  const { publishableKey, url } = getSupabasePublicEnv();

  return createSupabaseClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
