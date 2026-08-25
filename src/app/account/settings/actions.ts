"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  describeDatabaseError,
  fieldErrorsFromZod,
  formValues,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(120, "Names are limited to 120 characters.")
    .optional()
    .default(""),
});

export async function updateProfile(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/account/settings");
  const values = formValues(formData, ["fullName"]);

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
  });
  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName || null })
    .eq("id", viewer.id)
    .select("id");

  if (error || !data?.length) {
    return invalid(
      describeDatabaseError(error, "Your profile could not be saved."),
      { values },
    );
  }

  revalidatePath("/account/settings");
  return succeeded("Profile saved.");
}

const preferencesSchema = z.object({
  leadEmails: z.coerce.boolean(),
  moderationEmails: z.coerce.boolean(),
  productEmails: z.coerce.boolean(),
  reviewRequestEmails: z.coerce.boolean(),
});

export async function updateNotificationPreferences(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/account/settings");

  const parsed = preferencesSchema.safeParse({
    // An unchecked checkbox submits nothing, so absence means false.
    leadEmails: formData.get("leadEmails") === "on",
    moderationEmails: formData.get("moderationEmails") === "on",
    productEmails: formData.get("productEmails") === "on",
    reviewRequestEmails: formData.get("reviewRequestEmails") === "on",
  });
  if (!parsed.success) return invalid("Those preferences could not be saved.");

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      lead_emails: parsed.data.leadEmails,
      moderation_emails: parsed.data.moderationEmails,
      product_emails: parsed.data.productEmails,
      review_request_emails: parsed.data.reviewRequestEmails,
      user_id: viewer.id,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return invalid(
      describeDatabaseError(error, "Those preferences could not be saved."),
    );
  }

  revalidatePath("/account/settings");
  return succeeded("Email preferences saved.");
}

const deletionSchema = z.object({
  confirm: z.literal("DELETE", {
    error: "Type DELETE exactly to confirm.",
  }),
  reason: z.string().trim().max(1000).optional().default(""),
});

/**
 * Records a deletion request rather than deleting immediately.
 *
 * Erasure has to be reconciled against records the law requires us to keep —
 * payment history in particular — so it is an operator-run process. The request
 * itself is the user-facing right; `anonymize_expired_records` and the
 * `on delete set null` customer references are what make it executable.
 */
export async function requestAccountDeletion(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/account/settings");
  const values = formValues(formData, ["reason"]);

  const parsed = deletionSchema.safeParse({
    confirm: formData.get("confirm"),
    reason: formData.get("reason") ?? "",
  });

  if (!parsed.success) {
    return invalid("Please confirm before continuing.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("account_deletion_requests")
    .upsert(
      { reason: parsed.data.reason || null, user_id: viewer.id },
      { onConflict: "user_id" },
    );

  if (error) {
    return invalid(
      describeDatabaseError(
        error,
        "We could not record your request. Please contact the grievance officer.",
      ),
      { values },
    );
  }

  revalidatePath("/account/settings");
  return succeeded(
    "Your deletion request is recorded. We will confirm by email within 15 days, and your enquiries will be detached from your identity.",
  );
}
