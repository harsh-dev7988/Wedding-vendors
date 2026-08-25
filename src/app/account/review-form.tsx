"use client";

import { Star } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { submitReview } from "./actions";

export function ReviewForm({
  leadId,
  vendorName,
}: {
  readonly leadId: string;
  readonly vendorName: string;
}) {
  const [state, action] = useActionState(submitReview, idleState);
  const errors = state.fieldErrors ?? {};
  const ratingId = `rating-${leadId}`;
  const bodyId = `body-${leadId}`;

  return (
    <form
      action={action}
      className="border-border mt-6 space-y-3 border-t pt-5"
    >
      <h3 className="inline-flex items-center gap-2 font-bold">
        <Star aria-hidden="true" className="text-brand-solid" size={18} />{" "}
        Review {vendorName}
      </h3>

      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <input name="leadId" type="hidden" value={leadId} />

      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <label className="grid gap-1.5 text-sm font-bold" htmlFor={ratingId}>
          Rating
          <select
            className="border-border select-field min-h-11 rounded-xl border px-3 font-medium"
            defaultValue={state.values?.rating ?? "5"}
            id={ratingId}
            name="rating"
            required
          >
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Very good</option>
            <option value="3">3 — Fine</option>
            <option value="2">2 — Poor</option>
            <option value="1">1 — Very poor</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold" htmlFor={bodyId}>
          Your review
          <textarea
            aria-describedby={errors.body ? `${bodyId}-error` : undefined}
            aria-invalid={errors.body ? true : undefined}
            className="border-border min-h-28 rounded-xl border p-3 font-medium"
            defaultValue={state.values?.body ?? ""}
            id={bodyId}
            maxLength={3000}
            minLength={30}
            name="body"
            placeholder="What was the service like? At least 30 characters."
            required
          />
          <FieldError id={`${bodyId}-error`} message={errors.body} />
        </label>
      </div>

      <SubmitButton
        className="bg-brand-solid hover:bg-brand-solid-hover min-h-11 rounded-xl px-5 text-sm text-white"
        pendingLabel="Submitting…"
      >
        Submit for moderation
      </SubmitButton>
      <p className="text-muted-foreground text-xs">
        Reviews are published after moderation. Only customers who sent an
        enquiry through this marketplace can review a vendor.
      </p>
    </form>
  );
}
