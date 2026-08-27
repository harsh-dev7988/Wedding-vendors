import "server-only";

import { formatEventDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { sendTransactionalEmail } from "./send";
import {
  listingModerationEmail,
  newLeadEmail,
  newMessageEmail,
  reviewRequestEmail,
  vendorApprovedEmail,
} from "./templates";

/**
 * Every function here is best-effort and never throws.
 *
 * The user's action — the enquiry, the moderation decision — is already
 * committed by the time these run. A mail provider outage must not surface as a
 * failed enquiry, and must never roll one back.
 */

type LeadTarget = {
  business_name: string;
  listing_slug: string;
  listing_title: string;
  notify_email: string | null;
  owner_user_id: string | null;
  vendor_id: string;
};

export async function notifyVendorOfLead(input: {
  eventDate: string;
  guestCount: number | null;
  leadId: string;
}) {
  try {
    const supabase = await createClient();
    // Security-definer lookup: it reads `vendor_contacts`, which no client role
    // can select, and it verifies the caller owns this lead before returning.
    const { data, error } = await supabase.rpc("get_lead_notification_target", {
      requested_lead_id: input.leadId,
    });

    if (error) return;
    const target = (Array.isArray(data) ? data[0] : data) as
      LeadTarget | undefined;
    if (!target?.notify_email) return;

    await sendTransactionalEmail({
      content: newLeadEmail({
        businessName: target.business_name,
        eventDate: formatEventDate(input.eventDate),
        guestCount: input.guestCount,
        listingTitle: target.listing_title,
      }),
      dedupeKey: `lead-created:${input.leadId}`,
      recipientUserId: target.owner_user_id ?? undefined,
      template: "new-lead",
      to: target.notify_email,
    });
  } catch (cause) {
    console.error(
      "[notify] lead email failed",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}

/** Admin-side lookup of a vendor's notification address. */
async function getVendorEmail(vendorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_contacts")
    .select("email")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return (data?.email as string | null) ?? null;
}

export async function notifyVendorOfListingDecision(input: {
  action: "publish" | "reject" | "suspend";
  listingId: string;
  note: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("listings")
      // `moderated_at` is granted to no client role, and naming it made this
      // query fail outright — so this returned early and no listing moderation
      // email was ever sent. It comes from the definer RPC below.
      .select("id, title, slug, vendor_id")
      .eq("id", input.listingId)
      .maybeSingle();

    if (!data) return;
    const { data: privateRows } = await supabase.rpc(
      "get_listing_private_details",
      { requested_listing_ids: [input.listingId] },
    );
    const moderatedAt =
      ((privateRows ?? [])[0] as { moderated_at: string | null } | undefined)
        ?.moderated_at ?? "";
    const email = await getVendorEmail(data.vendor_id as string);
    if (!email) return;

    await sendTransactionalEmail({
      content: listingModerationEmail({
        action: input.action,
        listingTitle: data.title as string,
        note: input.note,
        slug: data.slug as string,
      }),
      // Keyed on the moderation timestamp so a later decision on the same
      // listing sends again, but a retry of this one does not.
      dedupeKey: `listing-${input.action}:${input.listingId}:${moderatedAt}`,
      template: `listing-${input.action}`,
      to: email,
    });
  } catch (cause) {
    console.error(
      "[notify] listing decision email failed",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}

export async function notifyVendorOfApproval(vendorId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("vendors")
      .select("business_name, verified_at")
      .eq("id", vendorId)
      .maybeSingle();

    if (!data) return;
    const email = await getVendorEmail(vendorId);
    if (!email) return;

    await sendTransactionalEmail({
      content: vendorApprovedEmail({
        businessName: data.business_name as string,
      }),
      dedupeKey: `vendor-approved:${vendorId}:${data.verified_at ?? ""}`,
      template: "vendor-approved",
      to: email,
    });
  } catch (cause) {
    console.error(
      "[notify] vendor approval email failed",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}

/**
 * Invite a review once a vendor marks an enquiry complete.
 *
 * The customer's address comes from `auth.users` via the admin API in a future
 * batch job; for now the vendor-triggered path uses the lead's customer id and
 * the profile email exposed to the authenticated caller. When neither is
 * available the send is skipped rather than guessed.
 */
export async function notifyCustomerOfReviewInvite(input: {
  customerEmail: string | null;
  leadId: string;
  listingSlug: string;
  listingTitle: string;
}) {
  if (!input.customerEmail) return;
  try {
    await sendTransactionalEmail({
      content: reviewRequestEmail({
        listingSlug: input.listingSlug,
        listingTitle: input.listingTitle,
      }),
      dedupeKey: `review-invite:${input.leadId}`,
      template: "review-invite",
      to: input.customerEmail,
    });
  } catch (cause) {
    console.error(
      "[notify] review invite failed",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}

type MessageTarget = {
  listing_slug: string;
  listing_title: string;
  preview: string;
  recipient_email: string | null;
  recipient_id: string | null;
  recipient_type: "customer" | "vendor";
};

/**
 * Email the other party about a new thread message.
 *
 * The recipient's address is resolved by a security-definer function: a
 * customer's lives in `auth.users` and a vendor's in `vendor_contacts`, and no
 * client role may read either. The function also re-checks that the caller is a
 * participant, so this cannot be used to probe for addresses.
 */
export async function notifyOfNewMessage(messageId: string, leadId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_message_notification_target",
      { requested_message_id: messageId },
    );

    if (error) return;
    const target = (Array.isArray(data) ? data[0] : data) as
      MessageTarget | undefined;
    if (!target?.recipient_email) return;

    // Each side has its own view of the same thread.
    const threadUrl =
      target.recipient_type === "customer"
        ? `/account/enquiries/${leadId}`
        : `/vendor/dashboard/leads/${leadId}`;

    await sendTransactionalEmail({
      content: newMessageEmail({
        from: target.recipient_type === "customer" ? "vendor" : "customer",
        listingTitle: target.listing_title,
        preview: target.preview,
        threadUrl,
      }),
      dedupeKey: `message:${messageId}`,
      recipientUserId: target.recipient_id ?? undefined,
      template: "new-message",
      to: target.recipient_email,
    });
  } catch (cause) {
    console.error(
      "[notify] message email failed",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}
