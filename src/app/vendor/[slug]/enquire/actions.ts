"use server";

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
import { notifyVendorOfLead } from "@/lib/email/notifications";
import { indiaToday } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const enquirySchema = z.object({
  eventDate: z.iso.date("Choose a valid event date."),
  guestCount: z.union([
    z.literal(""),
    z.coerce
      .number()
      .int("Enter a whole number of guests.")
      .min(1, "Enter at least one guest.")
      .max(100000, "Enter 100,000 guests or fewer."),
  ]),
  listingId: z.uuid(),
  message: z
    .string()
    .trim()
    .min(20, "Add at least 20 characters so the vendor can respond usefully.")
    .max(2000, "Keep the message under 2,000 characters."),
  slug: z.string().regex(SLUG_PATTERN),
});

const FIELDS = ["eventDate", "guestCount", "message"] as const;

export async function submitEnquiry(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawSlug = formData.get("slug");
  const slug =
    typeof rawSlug === "string" && SLUG_PATTERN.test(rawSlug) ? rawSlug : "";
  const values = formValues(formData, FIELDS);

  if (!slug)
    return invalid("This listing could not be identified.", { values });

  await requireViewer(`/vendor/${slug}/enquire`);

  const parsed = enquirySchema.safeParse({
    eventDate: formData.get("eventDate"),
    guestCount: formData.get("guestCount"),
    listingId: formData.get("listingId"),
    message: formData.get("message"),
    slug,
  });

  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  // Compared against the Indian calendar date, not the server's UTC date:
  // between midnight and 05:30 IST a same-day event was rejected as past.
  if (parsed.data.eventDate < indiaToday()) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: { eventDate: "Choose today's date or a later date." },
      values,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_enquiry_and_reveal", {
    requested_event_date: parsed.data.eventDate,
    requested_guest_count:
      parsed.data.guestCount === "" ? null : parsed.data.guestCount,
    requested_listing_id: parsed.data.listingId,
    requested_message: parsed.data.message,
  });

  const result = Array.isArray(data) ? data[0] : data;

  if (error || !result?.lead_id) {
    return invalid(
      describeDatabaseError(
        error,
        "The enquiry could not be sent. Please try again shortly.",
      ),
      { values },
    );
  }

  // Best-effort and awaited before the redirect so the send is not cut short by
  // the function suspending. A mail failure never fails the enquiry — the lead
  // and the reveal are already committed.
  await notifyVendorOfLead({
    eventDate: parsed.data.eventDate,
    guestCount: parsed.data.guestCount === "" ? null : parsed.data.guestCount,
    leadId: result.lead_id as string,
  });

  // Only the lead id is used. The RPC also returns the vendor's contact
  // details; they stay in this server scope and are never part of the value
  // this action returns to the browser.
  redirect(`/account/enquiries/${result.lead_id}?created=1`);
}
