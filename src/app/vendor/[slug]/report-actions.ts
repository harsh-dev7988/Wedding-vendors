"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  fieldErrorsFromZod,
  formValues,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  detail: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters.")
    .max(2000, "Keep the description under 2,000 characters."),
  listingId: z.uuid(),
  reason: z.enum([
    "inaccurate",
    "not_a_real_business",
    "offensive",
    "spam",
    "duplicate",
    "other",
  ]),
});

/**
 * Files an abuse report against a published listing.
 *
 * The insert policy already restricts this to signed-in users reporting
 * published listings, and a partial unique index allows one open report per
 * person per listing. That duplicate is reported back as success rather than
 * an error: telling someone "you already reported this" is the same outcome
 * from their point of view, and denying it leaks nothing useful either way.
 */
export async function submitListingReport(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["reason", "detail"]);
  const viewer = await getViewer();

  if (!viewer) {
    return invalid("Sign in first so we can follow up on your report.", {
      values,
    });
  }

  const parsed = schema.safeParse({
    detail: formData.get("detail"),
    listingId: formData.get("listingId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    detail: parsed.data.detail,
    listing_id: parsed.data.listingId,
    reason: parsed.data.reason,
    reporter_id: viewer.id,
  });

  // 23505 is the one-open-report-per-listing index.
  if (error && error.code !== "23505") {
    return invalid("The report could not be filed. Please try again shortly.", {
      values,
    });
  }

  revalidatePath("/admin/reports");
  return succeeded(
    "Thank you. Our moderation team will review this listing. We may contact you if we need more detail.",
  );
}
