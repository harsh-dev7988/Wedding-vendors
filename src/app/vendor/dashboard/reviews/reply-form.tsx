"use client";

import { Reply } from "lucide-react";
import { useActionState } from "react";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { replyToReview } from "./actions";

export function ReplyForm({
  existingReply,
  reviewId,
}: {
  readonly existingReply: string | null;
  readonly reviewId: string;
}) {
  const [state, action] = useActionState(replyToReview, idleState);
  const fieldId = `reply-${reviewId}`;

  return (
    <form action={action} className="border-border mt-4 border-t pt-4">
      <input name="reviewId" type="hidden" value={reviewId} />

      {state.status === "error" && (
        <FormAlert className="mb-3">{state.message}</FormAlert>
      )}
      {state.status === "success" && (
        <StatusBanner className="mb-3">{state.message}</StatusBanner>
      )}

      <label className="grid gap-1.5 text-sm font-bold" htmlFor={fieldId}>
        {existingReply ? "Edit your reply" : "Reply publicly"}
        <textarea
          className="border-border focus:border-brand-text min-h-20 rounded-xl border p-3 font-medium"
          defaultValue={existingReply ?? ""}
          id={fieldId}
          maxLength={2000}
          name="reply"
          placeholder="Thank the customer, or add context. This appears under the review on your public profile."
          required
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Visible to everyone. You cannot change the rating or the review text.
        </p>
        <SubmitButton
          className="bg-foreground hover:bg-brand-solid-hover min-h-11 rounded-full px-4 text-sm text-white"
          pendingLabel="Publishing…"
        >
          <Reply aria-hidden="true" size={15} />
          {existingReply ? "Update reply" : "Publish reply"}
        </SubmitButton>
      </div>
    </form>
  );
}
