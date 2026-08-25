"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

type Action = {
  readonly label: string;
  readonly value: string;
  /** Destructive actions ask for confirmation and a reason. */
  readonly destructive?: boolean;
};

/**
 * Moderation controls with a confirmation step and an optional note.
 *
 * Suspending a vendor takes every published listing offline, so a single
 * mis-click used to be an unconfirmed, unexplained takedown with no record of
 * why. The note is written to `audit_logs` and, for listings, surfaced to the
 * vendor as rejection feedback.
 */
export function ModerationForm({
  action,
  actions,
  entityId,
  entityLabel,
}: {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly actions: readonly Action[];
  readonly entityId: string;
  readonly entityLabel: string;
}) {
  const [pendingAction, setPendingAction] = useState<Action | null>(null);

  if (pendingAction) {
    return (
      <form
        action={action}
        className="border-border mt-5 rounded-2xl border p-4"
      >
        <input name="id" type="hidden" value={entityId} />
        <input name="action" type="hidden" value={pendingAction.value} />
        <p className="text-sm font-bold">
          Confirm “{pendingAction.label}” for {entityLabel}?
        </p>
        <label
          className="mt-3 grid gap-1.5 text-xs font-bold"
          htmlFor={`note-${entityId}`}
        >
          Reason (optional, recorded in the audit log)
          <textarea
            className="border-border min-h-16 rounded-xl border p-2 text-sm font-medium"
            id={`note-${entityId}`}
            maxLength={2000}
            name="note"
            placeholder="Why is this decision being made?"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <SubmitButton
            className={`min-h-11 rounded-full px-4 text-sm text-white ${
              pendingAction.destructive
                ? "bg-brand-solid hover:bg-brand-solid-hover"
                : "bg-success"
            }`}
            pendingLabel="Applying…"
          >
            Yes, {pendingAction.label.toLowerCase()}
          </SubmitButton>
          <button
            className="border-border min-h-11 rounded-full border px-4 text-sm font-bold"
            onClick={() => setPendingAction(null)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {actions.map((item) => (
        <button
          className={
            item.destructive
              ? "border-border hover:border-brand-text/50 min-h-11 rounded-full border px-4 text-sm font-bold transition"
              : "bg-success min-h-11 rounded-full px-4 text-sm font-bold text-white"
          }
          key={item.value}
          onClick={() => setPendingAction(item)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
