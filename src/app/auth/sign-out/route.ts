import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Route Handlers do not get the Origin check that Next applies to Server
 * Actions, so a cross-site form POST could otherwise sign a user out.
 */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Same-origin form posts may omit Origin.
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const home = new URL("/", request.nextUrl.origin);

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) await supabase.auth.signOut();
  }

  // No `revalidatePath("/", "layout")`: that flushed the entire application
  // cache for every visitor each time one person signed out. Session state is
  // read per-request, so nothing cached needs invalidating.
  return NextResponse.redirect(home, { status: 303 });
}
