"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";
import { sendMessage } from "@/lib/actions/messages";

export function MessageComposer({
  counterpartyLabel,
  leadId,
  returnTo,
}: {
  readonly counterpartyLabel: string;
  readonly leadId: string;
  readonly returnTo: string;
}) {
  const [state, action] = useActionState(sendMessage, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const sentCount = useRef(0);

  // Clear the box only after a send that did not come back with an error,
  // so a failed submit never discards what was typed.
  useEffect(() => {
    if (state.status === "idle" && sentCount.current > 0)
      formRef.current?.reset();
  }, [state]);

  return (
    <form
      action={action}
      className="mt-6"
      onSubmit={() => {
        sentCount.current += 1;
      }}
      ref={formRef}
    >
      <input name="leadId" type="hidden" value={leadId} />
      <input name="returnTo" type="hidden" value={returnTo} />

      {state.status === "error" && (
        <FormAlert className="mb-3">{state.message}</FormAlert>
      )}

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="message-body">
        Reply to {counterpartyLabel}
        <textarea
          className="border-border focus:border-brand-text min-h-24 rounded-2xl border p-3 font-medium"
          defaultValue={state.values?.body ?? ""}
          id="message-body"
          maxLength={4000}
          name="body"
          placeholder="Type your message…"
          required
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          They will be notified by email.
        </p>
        <SubmitButton
          className="bg-brand-solid hover:bg-brand-solid-hover min-h-11 rounded-full px-5 text-sm text-white"
          pendingLabel="Sending…"
        >
          <Send aria-hidden="true" size={16} /> Send
        </SubmitButton>
      </div>
    </form>
  );
}
