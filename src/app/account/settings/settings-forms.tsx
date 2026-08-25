"use client";

import { Save, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { FieldError, FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import {
  requestAccountDeletion,
  updateNotificationPreferences,
  updateProfile,
} from "./actions";

export function ProfileForm({ fullName }: { readonly fullName: string }) {
  const [state, action] = useActionState(updateProfile, idleState);
  const error = state.fieldErrors?.fullName;

  return (
    <form action={action} className="mt-5 space-y-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {state.status === "success" && (
        <StatusBanner>{state.message}</StatusBanner>
      )}

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="fullName">
        Your name{" "}
        <span className="text-muted-foreground font-medium">Optional</span>
        <input
          aria-describedby={`fullName-hint${error ? " fullName-error" : ""}`}
          aria-invalid={error ? true : undefined}
          autoComplete="name"
          className="border-border focus:border-brand-text min-h-12 max-w-md rounded-xl border px-3 font-medium"
          defaultValue={state.values?.fullName ?? fullName}
          id="fullName"
          maxLength={120}
          name="fullName"
        />
        <span className="text-muted-foreground text-xs" id="fullName-hint">
          Shown to vendors you contact, so they know who they are replying to.
        </span>
        <FieldError id="fullName-error" message={error} />
      </label>

      <SubmitButton
        className="bg-foreground hover:bg-brand-solid-hover min-h-11 rounded-xl px-5 text-sm text-white"
        pendingLabel="Saving…"
      >
        <Save aria-hidden="true" size={16} /> Save profile
      </SubmitButton>
    </form>
  );
}

type Preferences = {
  readonly leadEmails: boolean;
  readonly moderationEmails: boolean;
  readonly productEmails: boolean;
  readonly reviewRequestEmails: boolean;
};

const TOGGLES = [
  {
    hint: "Sent to your business email when a customer enquires.",
    label: "New enquiry alerts",
    name: "leadEmails",
  },
  {
    hint: "When a listing is published, returned or suspended.",
    label: "Moderation decisions",
    name: "moderationEmails",
  },
  {
    hint: "An invitation to review a vendor after your event.",
    label: "Review invitations",
    name: "reviewRequestEmails",
  },
  {
    hint: "Occasional updates about new features. Off by default.",
    label: "Product updates",
    name: "productEmails",
  },
] as const;

export function NotificationForm({
  preferences,
}: {
  readonly preferences: Preferences;
}) {
  const [state, action] = useActionState(
    updateNotificationPreferences,
    idleState,
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {state.status === "success" && (
        <StatusBanner>{state.message}</StatusBanner>
      )}

      <fieldset className="space-y-3">
        <legend className="sr-only">Email preferences</legend>
        {TOGGLES.map((toggle) => (
          <label
            className="border-border flex items-start gap-3 rounded-2xl border p-4"
            key={toggle.name}
          >
            <input
              className="mt-1 size-5 shrink-0 accent-[color:var(--brand-solid)]"
              defaultChecked={preferences[toggle.name]}
              name={toggle.name}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-bold">{toggle.label}</span>
              <span className="text-muted-foreground block text-xs leading-5">
                {toggle.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton
        className="bg-foreground hover:bg-brand-solid-hover min-h-11 rounded-xl px-5 text-sm text-white"
        pendingLabel="Saving…"
      >
        <Save aria-hidden="true" size={16} /> Save preferences
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({
  alreadyRequested,
}: {
  readonly alreadyRequested: boolean;
}) {
  const [state, action] = useActionState(requestAccountDeletion, idleState);
  const [confirming, setConfirming] = useState(false);

  if (alreadyRequested || state.status === "success") {
    return (
      <StatusBanner className="mt-5">
        {state.status === "success"
          ? state.message
          : "A deletion request is already recorded for this account. Contact the grievance officer if you want to cancel it."}
      </StatusBanner>
    );
  }

  if (!confirming) {
    return (
      <button
        className="border-brand-text/40 text-brand-text hover:bg-brand-soft mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold transition"
        onClick={() => setConfirming(true)}
        type="button"
      >
        <TriangleAlert aria-hidden="true" size={16} /> Request account deletion
      </button>
    );
  }

  return (
    <form
      action={action}
      className="border-brand-text/30 bg-brand-soft/50 mt-5 space-y-4 rounded-2xl border p-5"
    >
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <p className="text-sm leading-6">
        We will erase your profile and detach your enquiries and reviews from
        your identity. Payment records are kept where tax law requires it. This
        cannot be undone.
      </p>

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="deleteReason">
        Why are you leaving?{" "}
        <span className="text-muted-foreground font-medium">Optional</span>
        <textarea
          className="border-border min-h-20 rounded-xl border p-3 font-medium"
          defaultValue={state.values?.reason ?? ""}
          id="deleteReason"
          maxLength={1000}
          name="reason"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="deleteConfirm">
        Type DELETE to confirm
        <input
          aria-describedby={
            state.fieldErrors?.confirm ? "deleteConfirm-error" : undefined
          }
          aria-invalid={state.fieldErrors?.confirm ? true : undefined}
          className="border-border min-h-12 max-w-xs rounded-xl border px-3 font-mono"
          id="deleteConfirm"
          name="confirm"
          required
        />
        <FieldError
          id="deleteConfirm-error"
          message={state.fieldErrors?.confirm}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <SubmitButton
          className="bg-brand-solid hover:bg-brand-solid-hover min-h-11 rounded-full px-5 text-sm text-white"
          pendingLabel="Submitting…"
        >
          Confirm deletion request
        </SubmitButton>
        <button
          className="border-border min-h-11 rounded-full border px-5 text-sm font-bold"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
