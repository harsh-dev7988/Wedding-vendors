import { type NextRequest, NextResponse } from "next/server";

import { safeInternalPath } from "@/lib/navigation";
import { updateSession } from "@/lib/supabase/proxy";

/** Where a PKCE `code` is actually exchanged for a session. */
const CONFIRM_PATH = "/auth/confirm";

export async function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  // When the `redirect_to` an OAuth sign-in asks for is not on Supabase's
  // redirect allow-list, Supabase silently falls back to the project's Site
  // URL — dropping the path. The visitor lands on `/?code=…`, nothing exchanges
  // the code, and they appear signed out with no error to explain it.
  //
  // Forwarding the code to the route that handles it turns that dead end into a
  // completed sign-in. It is a safety net, not a substitute for the allow-list:
  // the code is single-use and still verified by Supabase, so nothing is
  // weakened by exchanging it a path later than intended.
  if (code && request.nextUrl.pathname !== CONFIRM_PATH) {
    const confirm = new URL(CONFIRM_PATH, request.nextUrl.origin);
    confirm.searchParams.set("code", code);
    // Send them onward to wherever they were headed, defaulting to the page
    // they landed on. `safeInternalPath` keeps this same-origin.
    confirm.searchParams.set(
      "next",
      safeInternalPath(
        request.nextUrl.searchParams.get("next") ?? request.nextUrl.pathname,
      ),
    );
    return NextResponse.redirect(confirm);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
