"use client";

import { Building2, LockKeyhole } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { startVendorApplication } from "./actions";

export function ApplyForm({
  defaultEmail,
}: {
  readonly defaultEmail?: string;
}) {
  const [state, action] = useActionState(startVendorApplication, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      className="border-border shadow-warm mt-10 space-y-5 rounded-[2rem] border bg-white p-7 md:p-9"
    >
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <label className="grid gap-2 text-sm font-bold" htmlFor="businessName">
        Business name
        <input
          aria-describedby={
            errors.businessName ? "businessName-error" : undefined
          }
          aria-invalid={errors.businessName ? true : undefined}
          className="border-border focus:border-brand-text min-h-13 rounded-2xl border px-4 font-medium"
          defaultValue={state.values?.businessName ?? ""}
          id="businessName"
          maxLength={160}
          name="businessName"
          required
        />
        <FieldError id="businessName-error" message={errors.businessName} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold" htmlFor="phone">
          Business phone
          <input
            aria-describedby={`phone-hint${errors.phone ? " phone-error" : ""}`}
            aria-invalid={errors.phone ? true : undefined}
            autoComplete="tel"
            className="border-border focus:border-brand-text min-h-13 rounded-2xl border px-4 font-medium"
            defaultValue={state.values?.phone ?? ""}
            id="phone"
            inputMode="tel"
            maxLength={24}
            name="phone"
            placeholder="98765 43210"
            required
          />
          <span className="text-muted-foreground text-xs" id="phone-hint">
            10-digit Indian mobile, or an international number with +.
          </span>
          <FieldError id="phone-error" message={errors.phone} />
        </label>

        <label className="grid gap-2 text-sm font-bold" htmlFor="email">
          Business email{" "}
          <span className="text-muted-foreground font-medium">Optional</span>
          <input
            aria-describedby={errors.email ? "email-error" : undefined}
            aria-invalid={errors.email ? true : undefined}
            autoComplete="email"
            className="border-border focus:border-brand-text min-h-13 rounded-2xl border px-4 font-medium"
            defaultValue={state.values?.email ?? defaultEmail ?? ""}
            id="email"
            maxLength={254}
            name="email"
            type="email"
          />
          <FieldError id="email-error" message={errors.email} />
        </label>
      </div>

      <p className="bg-muted text-muted-foreground rounded-2xl p-4 text-sm leading-6">
        <LockKeyhole
          aria-hidden="true"
          className="text-brand-text mr-2 inline"
          size={17}
        />
        These contact details are stored in a private table with no public read
        access. They are released only to a signed-in customer who submits a
        validated enquiry, and every release is recorded.
      </p>

      <SubmitButton
        className="bg-foreground hover:bg-brand-solid-hover min-h-13 w-full rounded-2xl px-5 text-white"
        pendingLabel="Creating workspace…"
      >
        <Building2 aria-hidden="true" size={18} /> Create vendor workspace
      </SubmitButton>
    </form>
  );
}
