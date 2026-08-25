"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { siteConfig } from "@/config/site";
import {
  fieldErrorsFromZod,
  formValues,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { isGoogleAuthEnabled, isSupabaseConfigured } from "@/lib/env";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
});

export async function sendSignInLink(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const next = safeInternalPath(formData.get("next"));

  if (!isSupabaseConfigured()) {
    return invalid(
      "Authentication is ready but the Supabase connection is not configured yet.",
      { values },
    );
  }

  const parsed = signInSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return invalid("Check the email address and try again.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const confirmUrl = new URL("/auth/confirm", siteConfig.url);
  confirmUrl.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: confirmUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    // Supabase applies its own per-address and per-IP throttle. Surfacing that
    // distinctly stops a rate-limited person retyping a correct address.
    if (error.status === 429) {
      return invalid(
        "Too many sign-in emails have been requested for this address. Please wait a few minutes and try again.",
        { values },
      );
    }
    return invalid(
      "The sign-in email could not be sent. Please try again shortly.",
      { values },
    );
  }

  return succeeded(
    "Check your inbox for the sign-in link. It expires shortly and can be used once.",
  );
}

/**
 * Hands the visitor to Google and comes back through /auth/confirm.
 *
 * The confirm route already exchanges a PKCE `code`, which is the same
 * parameter Google's redirect carries, so no second callback route is needed.
 * The code verifier is written to a cookie by this call — that only works
 * inside a Server Action or Route Handler, never a Server Component.
 */
export async function startGoogleSignIn(formData: FormData) {
  const next = safeInternalPath(formData.get("next"));
  const failure = new URL("/sign-in", siteConfig.url);
  failure.searchParams.set("next", next);

  if (!isGoogleAuthEnabled()) {
    failure.searchParams.set("error", "google-unavailable");
    redirect(`${failure.pathname}${failure.search}`);
  }

  const supabase = await createClient();
  const confirmUrl = new URL("/auth/confirm", siteConfig.url);
  confirmUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      // Consent is requested once; afterwards Google returns straight away.
      queryParams: { access_type: "offline", prompt: "consent" },
      redirectTo: confirmUrl.toString(),
    },
    provider: "google",
  });

  if (error || !data?.url) {
    failure.searchParams.set("error", "google-unavailable");
    redirect(`${failure.pathname}${failure.search}`);
  }

  // Off-origin by design: this is the only redirect in the application that
  // deliberately leaves it, and the destination comes from the Supabase client
  // rather than from anything the visitor supplied.
  redirect(data.url);
}
