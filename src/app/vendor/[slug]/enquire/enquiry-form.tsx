"use client";

import { CalendarDays, LockKeyhole, MessageCircle } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { submitEnquiry } from "./actions";

export function EnquiryForm({
  listingId,
  minDate,
  slug,
}: {
  readonly listingId: string;
  readonly minDate: string;
  readonly slug: string;
}) {
  const [state, action] = useActionState(submitEnquiry, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      className="border-border shadow-warm mt-9 space-y-5 rounded-[2rem] border bg-white p-7 md:p-9"
    >
      <input name="listingId" type="hidden" value={listingId} />
      <input name="slug" type="hidden" value={slug} />

      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold" htmlFor="eventDate">
          Event date
          <input
            aria-describedby={errors.eventDate ? "eventDate-error" : undefined}
            aria-invalid={errors.eventDate ? true : undefined}
            className="border-border min-h-13 rounded-2xl border px-4 font-medium"
            defaultValue={state.values?.eventDate ?? ""}
            id="eventDate"
            min={minDate}
            name="eventDate"
            required
            type="date"
          />
          <FieldError id="eventDate-error" message={errors.eventDate} />
        </label>
        <label className="grid gap-2 text-sm font-bold" htmlFor="guestCount">
          Approximate guests{" "}
          <span className="text-muted-foreground font-medium">Optional</span>
          <input
            aria-describedby={
              errors.guestCount ? "guestCount-error" : undefined
            }
            aria-invalid={errors.guestCount ? true : undefined}
            className="border-border min-h-13 rounded-2xl border px-4 font-medium"
            defaultValue={state.values?.guestCount ?? ""}
            id="guestCount"
            inputMode="numeric"
            max={100000}
            min={1}
            name="guestCount"
            type="number"
          />
          <FieldError id="guestCount-error" message={errors.guestCount} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold" htmlFor="message">
        What do you need?
        <textarea
          aria-describedby={`message-hint${errors.message ? " message-error" : ""}`}
          aria-invalid={errors.message ? true : undefined}
          className="border-border min-h-40 rounded-2xl border p-4 font-medium"
          defaultValue={state.values?.message ?? ""}
          id="message"
          maxLength={2000}
          minLength={20}
          name="message"
          placeholder="Tell the vendor about the functions, location, dates, and services you need…"
          required
        />
        <span className="text-muted-foreground text-xs" id="message-hint">
          Between 20 and 2,000 characters.
        </span>
        <FieldError id="message-error" message={errors.message} />
      </label>

      <p className="bg-muted text-muted-foreground rounded-2xl p-4 text-sm leading-6">
        <LockKeyhole
          aria-hidden="true"
          className="text-brand-text mr-2 inline"
          size={17}
        />
        Maximum five new vendor enquiries per 24 hours. Repeated enquiries to
        the same listing have a 15-minute cooldown.
      </p>

      <SubmitButton
        className="bg-brand-solid hover:bg-brand-solid-hover min-h-13 w-full rounded-2xl px-5 text-white"
        pendingLabel="Sending enquiry…"
      >
        <MessageCircle aria-hidden="true" size={18} /> Send enquiry and reveal
        contact
      </SubmitButton>
      <p className="text-muted-foreground text-center text-xs">
        <CalendarDays aria-hidden="true" className="mr-1 inline" size={14} />
        Only upcoming event dates are accepted.
      </p>
    </form>
  );
}
