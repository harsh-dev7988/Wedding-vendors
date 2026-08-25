"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  describeDatabaseError,
  formValues,
  invalid,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { notifyOfNewMessage } from "@/lib/email/notifications";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending.")
    .max(4000, "Keep the message under 4,000 characters."),
  leadId: z.uuid(),
});

/**
 * Post a message into a lead thread.
 *
 * The sender's side is derived inside `send_lead_message` from their actual
 * relationship to the lead, so a customer cannot post as the vendor and vice
 * versa. The in-app notification is created in the same transaction; the email
 * is best-effort afterwards.
 */
export async function sendMessage(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireViewer("/account");
  const values = formValues(formData, ["body"]);
  const returnTo = safeInternalPath(formData.get("returnTo"));

  const parsed = messageSchema.safeParse({
    body: formData.get("body"),
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) {
    return invalid(
      parsed.error.issues[0]?.message ?? "That message could not be sent.",
      { values },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_lead_message", {
    requested_body: parsed.data.body,
    requested_lead_id: parsed.data.leadId,
  });

  const result = Array.isArray(data) ? data[0] : data;

  if (error || !result?.message_id) {
    return invalid(
      describeDatabaseError(
        error,
        "That message could not be sent. Please try again.",
      ),
      { values },
    );
  }

  await notifyOfNewMessage(result.message_id as string, parsed.data.leadId);

  revalidatePath(returnTo);
  return { status: "idle" };
}

/** Clear the unread badge for whichever side of the thread the caller is on. */
export async function markThreadRead(leadId: string) {
  const parsed = z.uuid().safeParse(leadId);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { requested_lead_id: parsed.data });
}
