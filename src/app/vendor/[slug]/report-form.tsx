"use client";

import { Flag } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";

import { FieldError, FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

import { submitListingReport } from "./report-actions";

const CONFIGURED = isSupabaseConfigured();

const REASONS = [
  { label: "Information is inaccurate", value: "inaccurate" },
  { label: "This is not a real business", value: "not_a_real_business" },
  { label: "Offensive or inappropriate content", value: "offensive" },
  { label: "Spam", value: "spam" },
  { label: "Duplicate of another listing", value: "duplicate" },
  { label: "Something else", value: "other" },
] as const;

/**
 * Collapsed by default. A report control is needed on every listing but it is
 * not what the page is for, so it stays out of the way until asked for.
 */
export function ReportListingForm({
  listingId,
}: {
  readonly listingId: string;
}) {
  // Read in the browser, not on the server. Calling getViewer() from the page
  // meant reading cookies, which opted every vendor page out of static
  // rendering — all 11 prerendered pages silently became dynamic.
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    if (!CONFIGURED) return;
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setSignedIn(Boolean(data.user));
      });
    return () => {
      active = false;
    };
  }, []);

  const [state, action] = useActionState(submitListingReport, idleState);
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const detailId = useId();
  const errors = state.fieldErrors ?? {};

  if (state.status === "success") {
    return <StatusBanner className="mt-6">{state.message}</StatusBanner>;
  }

  if (!open) {
    return (
      <button
        className="text-muted-foreground hover:text-foreground mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold transition"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Flag aria-hidden="true" size={15} /> Report this listing
      </button>
    );
  }

  return (
    <form
      action={action}
      className="border-border mt-6 rounded-3xl border p-5"
      aria-labelledby={`${reasonId}-heading`}
    >
      <h3 className="text-sm font-bold" id={`${reasonId}-heading`}>
        Report this listing
      </h3>
      <input name="listingId" type="hidden" value={listingId} />

      {!signedIn && (
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          You’ll need to sign in first — reports are tied to an account so we
          can follow up and so the queue cannot be flooded anonymously.
        </p>
      )}

      {state.status === "error" && (
        <FormAlert className="mt-4">{state.message}</FormAlert>
      )}

      <label className="mt-4 grid gap-1.5 text-xs font-bold" htmlFor={reasonId}>
        What is wrong?
        <select
          className="border-border select-field min-h-11 rounded-xl border bg-white px-3 text-sm font-semibold"
          defaultValue={state.values?.reason ?? ""}
          id={reasonId}
          name="reason"
          required
        >
          <option disabled value="">
            Choose a reason
          </option>
          {REASONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 grid gap-1.5 text-xs font-bold" htmlFor={detailId}>
        What should we look at?
        <textarea
          aria-describedby={errors.detail ? `${detailId}-error` : undefined}
          aria-invalid={errors.detail ? true : undefined}
          className="border-border min-h-24 rounded-xl border p-3 text-sm font-medium"
          defaultValue={state.values?.detail ?? ""}
          id={detailId}
          maxLength={2000}
          minLength={10}
          name="detail"
          placeholder="Be specific — which part of the listing, and why."
          required
        />
        <FieldError id={`${detailId}-error`} message={errors.detail} />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <SubmitButton
          className="bg-foreground min-h-11 rounded-full px-4 text-sm text-white"
          pendingLabel="Sending…"
        >
          Send report
        </SubmitButton>
        <button
          className="border-border min-h-11 rounded-full border px-4 text-sm font-bold"
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
