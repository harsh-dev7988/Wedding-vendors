import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

// Only the OTP types this application actually issues are accepted, rather
// than casting whatever the query string contains.
const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "recovery",
  "invite",
  "email_change",
]);

function parseOtpType(value: string | null): EmailOtpType | null {
  return value && ALLOWED_OTP_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

export async function GET(request: NextRequest) {
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"));

  // Built from the request's own origin, so the destination is same-origin by
  // construction regardless of what `next` contains.
  const destination = new URL(next, request.nextUrl.origin);
  const failure = new URL("/sign-in", request.nextUrl.origin);
  failure.searchParams.set("next", next);

  if (!isSupabaseConfigured()) {
    failure.searchParams.set("error", "not-configured");
    return NextResponse.redirect(failure);
  }

  // An OAuth provider reports refusal here rather than by omitting the code —
  // declining the Google consent screen lands on this route with
  // `error=access_denied`. Without this the visitor would see the generic
  // "invalid or expired link" message for a choice they made deliberately.
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    failure.searchParams.set(
      "error",
      providerError === "access_denied" ? "sign-in-cancelled" : "invalid-link",
    );
    return NextResponse.redirect(failure);
  }

  const supabase = await createClient();
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = parseOtpType(request.nextUrl.searchParams.get("type"));
  const code = request.nextUrl.searchParams.get("code");

  const result =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("Missing authentication token") };

  if (!result.error) return NextResponse.redirect(destination);

  failure.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(failure);
}
