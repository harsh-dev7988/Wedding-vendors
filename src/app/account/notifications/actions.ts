"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  await requireViewer("/account/notifications");
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");

  revalidatePath("/account/notifications");
  redirect("/account/notifications?marked=1");
}
