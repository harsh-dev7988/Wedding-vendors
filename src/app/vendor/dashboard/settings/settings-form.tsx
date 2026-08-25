"use client";

import { LockKeyhole, Save } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { updateVendorSettings } from "./actions";

export type VendorSettingsDefaults = {
  readonly businessName: string;
  readonly email: string;
  readonly legalName: string;
  readonly phone: string;
  readonly vendorId: string;
  readonly whatsapp: string;
};

export function VendorSettingsForm({
  canEdit,
  defaults,
}: {
  readonly canEdit: boolean;
  readonly defaults: VendorSettingsDefaults;
}) {
  const [state, action] = useActionState(updateVendorSettings, idleState);
  const errors = state.fieldErrors ?? {};
  const id = (field: string) => `${defaults.vendorId}-${field}`;
  const value = (field: keyof VendorSettingsDefaults) =>
    state.values?.[field] ?? defaults[field];

  return (
    <form
      action={action}
      className="border-border shadow-soft mt-6 space-y-5 rounded-[2rem] border bg-white p-6 md:p-8"
    >
      <input name="vendorId" type="hidden" value={defaults.vendorId} />

      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {state.status === "success" && (
        <StatusBanner>{state.message}</StatusBanner>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={id("businessName")}
        >
          Business name
          <input
            aria-describedby={
              errors.businessName ? id("businessName-error") : undefined
            }
            aria-invalid={errors.businessName ? true : undefined}
            className="border-border focus:border-brand-text min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("businessName")}
            disabled={!canEdit}
            id={id("businessName")}
            maxLength={160}
            name="businessName"
            required
          />
          <FieldError
            id={id("businessName-error")}
            message={errors.businessName}
          />
        </label>

        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={id("legalName")}
        >
          Registered legal name{" "}
          <span className="text-muted-foreground font-medium">Optional</span>
          <input
            className="border-border focus:border-brand-text min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("legalName")}
            disabled={!canEdit}
            id={id("legalName")}
            maxLength={200}
            name="legalName"
          />
        </label>
      </div>

      <fieldset className="border-border rounded-2xl border p-5">
        <legend className="px-2 text-sm font-bold">
          Private contact details
        </legend>
        <p className="text-muted-foreground mb-4 flex items-start gap-2 text-xs leading-5">
          <LockKeyhole
            aria-hidden="true"
            className="text-brand-text mt-0.5 shrink-0"
            size={14}
          />
          Never shown on your public profile. Released only to a signed-in
          customer who submits a validated enquiry, and every release is
          recorded.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <label
            className="grid gap-1.5 text-sm font-bold"
            htmlFor={id("phone")}
          >
            Phone
            <input
              aria-describedby={errors.phone ? id("phone-error") : undefined}
              aria-invalid={errors.phone ? true : undefined}
              className="border-border focus:border-brand-text min-h-12 rounded-xl border px-3 font-medium"
              defaultValue={value("phone")}
              disabled={!canEdit}
              id={id("phone")}
              inputMode="tel"
              maxLength={24}
              name="phone"
              required
            />
            <FieldError id={id("phone-error")} message={errors.phone} />
          </label>

          <label
            className="grid gap-1.5 text-sm font-bold"
            htmlFor={id("email")}
          >
            Email{" "}
            <span className="text-muted-foreground font-medium">Optional</span>
            <input
              aria-describedby={errors.email ? id("email-error") : undefined}
              aria-invalid={errors.email ? true : undefined}
              className="border-border focus:border-brand-text min-h-12 rounded-xl border px-3 font-medium"
              defaultValue={value("email")}
              disabled={!canEdit}
              id={id("email")}
              maxLength={254}
              name="email"
              type="email"
            />
            <FieldError id={id("email-error")} message={errors.email} />
          </label>

          <label
            className="grid gap-1.5 text-sm font-bold"
            htmlFor={id("whatsapp")}
          >
            WhatsApp{" "}
            <span className="text-muted-foreground font-medium">Optional</span>
            <input
              aria-describedby={
                errors.whatsapp ? id("whatsapp-error") : undefined
              }
              aria-invalid={errors.whatsapp ? true : undefined}
              className="border-border focus:border-brand-text min-h-12 rounded-xl border px-3 font-medium"
              defaultValue={value("whatsapp")}
              disabled={!canEdit}
              id={id("whatsapp")}
              inputMode="tel"
              maxLength={24}
              name="whatsapp"
            />
            <FieldError id={id("whatsapp-error")} message={errors.whatsapp} />
          </label>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Lead notification emails go to the email address above.
        </p>
      </fieldset>

      {canEdit ? (
        <SubmitButton
          className="bg-foreground hover:bg-brand-solid-hover min-h-12 rounded-xl px-6 text-sm text-white"
          pendingLabel="Saving…"
        >
          <Save aria-hidden="true" size={16} /> Save changes
        </SubmitButton>
      ) : (
        <p className="text-muted-foreground text-sm">
          Only an owner or manager can change these details.
        </p>
      )}
    </form>
  );
}
