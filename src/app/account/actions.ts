"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  describeDatabaseError,
  fieldErrorsFromZod,
  formValues,
  invalid,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  body: z
    .string()
    .trim()
    .min(30, "Write at least 30 characters.")
    .max(3000, "Keep the review under 3,000 characters."),
  leadId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
});

export async function submitReview(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireViewer("/account");
  const values = formValues(formData, ["body", "rating"]);

  const parsed = reviewSchema.safeParse({
    body: formData.get("body"),
    leadId: formData.get("leadId"),
    rating: formData.get("rating"),
  });

  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    requested_body: parsed.data.body,
    requested_lead_id: parsed.data.leadId,
    requested_rating: parsed.data.rating,
  });

  if (error) {
    return invalid(
      describeDatabaseError(
        error,
        "That review could not be submitted. Please try again shortly.",
      ),
      { values },
    );
  }

  revalidatePath("/account");
  redirect("/account?review=submitted");
}
