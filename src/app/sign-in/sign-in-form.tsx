"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { sendSignInLink } from "./actions";

export function SignInForm({
  configured,
  next,
}: {
  readonly configured: boolean;
  readonly next: string;
}) {
  const [state, action] = useActionState(sendSignInLink, idleState);
  const emailError = state.fieldErrors?.email;

  return (
    <>
      {state.status === "success" && (
        <StatusBanner className="mt-6">{state.message}</StatusBanner>
      )}
      {state.status === "error" && (
        <FormAlert className="mt-6">{state.message}</FormAlert>
      )}

      <form action={action} className="mt-7 space-y-4">
        <input name="next" type="hidden" value={next} />
        <label className="grid gap-2 text-sm font-bold" htmlFor="email">
          Email address
          <input
            aria-describedby={emailError ? "email-error" : undefined}
            aria-invalid={emailError ? true : undefined}
            autoComplete="email"
            className="border-border focus:border-brand-text min-h-13 rounded-2xl border px-4 font-medium transition aria-[invalid]:border-[color:var(--brand-text)]"
            defaultValue={state.values?.email ?? ""}
            disabled={!configured}
            id="email"
            maxLength={254}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
          <FieldError id="email-error" message={emailError} />
        </label>
        <SubmitButton
          className="bg-foreground hover:bg-brand-solid-hover min-h-13 w-full rounded-2xl px-5 text-sm text-white disabled:cursor-not-allowed"
          pendingLabel="Sending link…"
        >
          <Mail aria-hidden="true" size={17} /> Email me a sign-in link
        </SubmitButton>
      </form>
    </>
  );
}
