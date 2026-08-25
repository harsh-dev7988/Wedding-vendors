import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  getFromAddress,
  getReplyToAddress,
  getResend,
  isEmailConfigured,
} from "./client";
import type { EmailContent } from "./templates";

type SendOptions = {
  content: EmailContent;
  /** Stable key so a retried action never sends the same message twice. */
  dedupeKey: string;
  recipientUserId?: string;
  template: string;
  to: string;
};

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: "duplicate" | "not-configured" | "opted-out" }
  | { status: "failed"; reason: string };

/**
 * Send one transactional email, at most once per `dedupeKey`.
 *
 * The claim is written to `email_log` *before* the provider call, so a crash
 * between the two results in a missing email rather than a duplicate one. For
 * notifications that is the right way round: a vendor would rather miss a
 * duplicate than receive the same lead alert five times.
 *
 * Never throws. A failed notification must not fail the user's action — the
 * enquiry itself is already committed by the time this runs.
 */
export async function sendTransactionalEmail(
  options: SendOptions,
): Promise<SendResult> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[email] not configured — would send "${options.template}" to ${options.to}`,
      );
    }
    return { status: "skipped", reason: "not-configured" };
  }

  const supabase = await createClient();

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_email_send",
    {
      requested_dedupe_key: options.dedupeKey,
      requested_recipient: options.recipientUserId ?? null,
      requested_template: options.template,
    },
  );

  if (claimError) {
    console.error("[email] could not claim send", claimError.message);
    return { status: "failed", reason: "claim-failed" };
  }
  if (claimed !== true) return { status: "skipped", reason: "duplicate" };

  const resend = getResend();
  if (!resend) return { status: "skipped", reason: "not-configured" };

  try {
    const replyTo = getReplyToAddress();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: options.to,
      subject: options.content.subject,
      html: options.content.html,
      text: options.content.text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      await supabase.rpc("mark_email_sent", {
        requested_dedupe_key: options.dedupeKey,
        requested_error: error.message.slice(0, 500),
        requested_provider_id: null,
      });
      console.error("[email] provider rejected send", error.message);
      return { status: "failed", reason: error.message };
    }

    await supabase.rpc("mark_email_sent", {
      requested_dedupe_key: options.dedupeKey,
      requested_error: null,
      requested_provider_id: data?.id ?? null,
    });

    return { status: "sent", id: data?.id ?? null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown";
    await supabase.rpc("mark_email_sent", {
      requested_dedupe_key: options.dedupeKey,
      requested_error: message.slice(0, 500),
      requested_provider_id: null,
    });
    console.error("[email] send threw", message);
    return { status: "failed", reason: message };
  }
}
