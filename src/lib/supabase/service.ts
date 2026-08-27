import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses row level security entirely.
 *
 * There is exactly one legitimate caller: the Razorpay webhook, which arrives
 * with no user session and must still record a captured payment. Everything
 * else in this application uses the caller's own JWT so RLS applies.
 *
 * The key must never be prefixed `NEXT_PUBLIC_` and must never be imported
 * into a Client Component. `server-only` above makes that a build error.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to process payment webhooks.",
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
