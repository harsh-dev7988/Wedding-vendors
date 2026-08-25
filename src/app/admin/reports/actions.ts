"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["start", "action", "dismiss", "reopen"]),
  id: z.uuid(),
  note: z.string().trim().max(2000).optional(),
});

/**
 * Moves one abuse report through the queue.
 *
 * The status change and the audit entry are written together inside
 * `admin_resolve_report`, which re-checks `is_admin()` in the database. The
 * check here is the outer of two independent gates, not the only one.
 */
export async function resolveReport(formData: FormData) {
  const parsed = schema.safeParse({
    action: formData.get("action"),
    id: formData.get("id"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) redirect("/admin/reports?error=invalid-action");

  await requireViewer("/admin/reports");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const { error } = await supabase.rpc("admin_resolve_report", {
    requested_action: parsed.data.action,
    requested_note: parsed.data.note ?? null,
    requested_report_id: parsed.data.id,
  });

  if (error) redirect("/admin/reports?error=report-update-failed");

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  redirect(`/admin/reports?updated=report-${parsed.data.action}`);
}
