"use server";

import { z } from "zod";

import { siteConfig } from "@/config/site";
import {
  fieldErrorsFromZod,
  formValues,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { isSupabaseConfigured } from "@/lib/env";
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
