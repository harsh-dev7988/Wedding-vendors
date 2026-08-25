"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth";
import { safeInternalPath, withQuery } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

const listingIdSchema = z.uuid();

/**
 * Add or remove in one action.
 *
 * A single toggle keeps the control working without JavaScript: the button
 * does not need to know the current state to submit, and the database decides.
 */
export async function toggleShortlist(formData: FormData) {
  const returnTo = safeInternalPath(formData.get("returnTo"));
  const viewer = await requireViewer(returnTo);
  const listingId = listingIdSchema.safeParse(formData.get("listingId"));

  if (!listingId.success) {
    redirect(withQuery(returnTo, { shortlist: "invalid" }));
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("shortlists")
    .select("listing_id")
    .eq("customer_id", viewer.id)
    .eq("listing_id", listingId.data)
    .maybeSingle();

  if (readError) {
    redirect(withQuery(returnTo, { shortlist: "failed" }));
  }

  if (existing) {
    const { error, data } = await supabase
      .from("shortlists")
      .delete()
      .eq("customer_id", viewer.id)
      .eq("listing_id", listingId.data)
      .select("listing_id");

    if (error || !data?.length) {
      redirect(withQuery(returnTo, { shortlist: "failed" }));
    }
  } else {
    const { error, data } = await supabase
      .from("shortlists")
      .insert({ customer_id: viewer.id, listing_id: listingId.data })
      .select("listing_id");

    // A published listing is required by the insert policy, so a rejected row
    // here means the listing is no longer available rather than a server fault.
    if (error || !data?.length) {
      redirect(
        withQuery(returnTo, {
          shortlist: error?.code === "42501" ? "unavailable" : "failed",
        }),
      );
    }
  }

  revalidatePath("/shortlist");
  redirect(withQuery(returnTo, { shortlist: existing ? "removed" : "saved" }));
}

export async function removeFromShortlist(formData: FormData) {
  const viewer = await requireViewer("/shortlist");
  const listingId = listingIdSchema.safeParse(formData.get("listingId"));

  if (!listingId.success) {
    redirect("/shortlist?shortlist=invalid");
  }

  const { error, data } = await (
    await createClient()
  )
    .from("shortlists")
    .delete()
    .eq("customer_id", viewer.id)
    .eq("listing_id", listingId.data)
    .select("listing_id");

  // PostgREST reports no error when an update or delete matches nothing, so
  // the affected-row count is the only reliable success signal.
  if (error || !data?.length) {
    redirect("/shortlist?shortlist=failed");
  }

  revalidatePath("/shortlist");
  redirect("/shortlist?shortlist=removed");
}
