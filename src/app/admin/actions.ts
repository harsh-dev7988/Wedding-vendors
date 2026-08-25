"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { describeDatabaseError } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import {
  notifyVendorOfApproval,
  notifyVendorOfListingDecision,
} from "@/lib/email/notifications";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  await requireViewer("/admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  // The RPCs below re-check `is_admin()` inside the database, so this is the
  // outer of two independent gates rather than the only one.
  if (data !== true) redirect("/account");
  return supabase;
}

const noteSchema = z.string().trim().max(2000).optional();

/**
 * Public discovery is prerendered, so a moderation decision that is not
 * revalidated never reaches a visitor. Path revalidation with `"page"` covers
 * every generated param of a dynamic route.
 */
function revalidatePublicSurfaces() {
  revalidatePath("/admin");
  revalidatePath("/vendors");
  revalidatePath("/vendors/[city]/[category]", "page");
  revalidatePath("/vendor/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

export async function moderateVendor(formData: FormData) {
  const parsed = z
    .object({
      action: z.enum(["approve", "reinstate", "suspend"]),
      id: z.uuid(),
      note: noteSchema,
    })
    .safeParse({
      action: formData.get("action"),
      id: formData.get("id"),
      note: formData.get("note") || undefined,
    });

  if (!parsed.success) redirect("/admin?error=invalid-action");

  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_moderate_vendor", {
    requested_action: parsed.data.action,
    requested_note: parsed.data.note ?? null,
    requested_vendor_id: parsed.data.id,
  });

  if (error) {
    redirect(
      `/admin?error=${encodeURIComponent(
        describeDatabaseError(error, "vendor-update-failed"),
      )}`,
    );
  }

  if (parsed.data.action === "approve" || parsed.data.action === "reinstate") {
    await notifyVendorOfApproval(parsed.data.id);
  }

  revalidatePublicSurfaces();
  redirect(`/admin?updated=vendor-${parsed.data.action}`);
}

export async function moderateListing(formData: FormData) {
  const parsed = z
    .object({
      action: z.enum(["publish", "reject", "suspend"]),
      id: z.uuid(),
      note: noteSchema,
    })
    .safeParse({
      action: formData.get("action"),
      id: formData.get("id"),
      note: formData.get("note") || undefined,
    });

  if (!parsed.success) redirect("/admin?error=invalid-action");

  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_moderate_listing", {
    requested_action: parsed.data.action,
    requested_listing_id: parsed.data.id,
    requested_note: parsed.data.note ?? null,
  });

  if (error) {
    redirect(
      `/admin?error=${encodeURIComponent(
        describeDatabaseError(
          error,
          "The listing could not be published. It needs an approved vendor and at least one portfolio image.",
        ),
      )}`,
    );
  }

  await notifyVendorOfListingDecision({
    action: parsed.data.action,
    listingId: parsed.data.id,
    note: parsed.data.note ?? null,
  });

  revalidatePublicSurfaces();
  redirect(`/admin?updated=listing-${parsed.data.action}`);
}

export async function moderateReview(formData: FormData) {
  const parsed = z
    .object({ action: z.enum(["publish", "hide"]), id: z.uuid() })
    .safeParse({ action: formData.get("action"), id: formData.get("id") });

  if (!parsed.success) redirect("/admin?error=invalid-action");

  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_moderate_review", {
    requested_action: parsed.data.action,
    requested_review_id: parsed.data.id,
  });

  if (error) {
    redirect(
      `/admin?error=${encodeURIComponent(
        describeDatabaseError(error, "That review could not be updated."),
      )}`,
    );
  }

  // Publishing a review changes the listing's rating aggregate.
  revalidatePublicSurfaces();
  redirect(`/admin?updated=review-${parsed.data.action}`);
}
