"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  describeDatabaseError,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const replySchema = z.object({
  reply: z
    .string()
    .trim()
    .min(2, "Write a reply before publishing.")
    .max(2000, "Keep the reply under 2,000 characters."),
  reviewId: z.uuid(),
});

/**
 * Publish a public reply to a review.
 *
 * `reviews.vendor_reply` and its RLS policy have existed since the first
 * migration, and the reply already renders on the public profile — there was
 * simply no way for a vendor to write one. The column grant is restricted to
 * `vendor_reply`, so this cannot touch the rating, the body or the published
 * flag even if the policy were widened later.
 */
export async function replyToReview(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireViewer("/vendor/dashboard/reviews");

  const parsed = replySchema.safeParse({
    reply: formData.get("reply"),
    reviewId: formData.get("reviewId"),
  });

  if (!parsed.success) {
    return invalid(
      parsed.error.issues[0]?.message ?? "That reply could not be saved.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ vendor_reply: parsed.data.reply })
    .eq("id", parsed.data.reviewId)
    .select("id");

  // PostgREST reports no error when an update matches nothing, so the row
  // count is the only reliable success signal.
  if (error || !data?.length) {
    return invalid(
      describeDatabaseError(
        error,
        "That reply could not be saved. The review may belong to another business.",
      ),
    );
  }

  revalidatePath("/vendor/dashboard/reviews");
  revalidatePath("/vendor/[slug]", "page");
  return succeeded("Reply published on your public profile.");
}
