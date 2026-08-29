"use client";

import { Star } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SelectMenu } from "@/components/ui/select-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { submitReview } from "./actions";

/** Matches the text inputs beside it. */
const FIELD_CLASS =
  "border-border focus-within:border-brand-text min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold transition";

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
          <SelectMenu
            className={FIELD_CLASS}
            id={ratingId}
            label="Rating"
            name="rating"
            options={[
              { label: "5 — Excellent", value: "5" },
              { label: "4 — Very good", value: "4" },
              { label: "3 — Fine", value: "3" },
              { label: "2 — Poor", value: "2" },
              { label: "1 — Very poor", value: "1" },
            ]}
            value={state.values?.rating ?? "5"}
          />
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
