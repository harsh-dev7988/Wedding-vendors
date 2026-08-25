import "server-only";

import type { ThreadMessage } from "@/components/messaging/message-thread";
import { createClient } from "@/lib/supabase/server";

type MessageRow = {
  author_type: "customer" | "vendor" | "system";
  body: string;
  created_at: string;
  id: string;
};

/**
 * Load a thread and mark it read for the caller's side.
 *
 * Reading and marking happen together because every surface that renders a
 * thread should also clear its badge — separating them was how unread counts
 * drifted.
 */
export async function loadThread(leadId: string): Promise<ThreadMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_messages")
    .select("id, author_type, body, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  // Best-effort: a failure here must not stop the thread rendering. The
  // PostgREST builder is thenable but not a Promise, so it has no .catch().
  try {
    await supabase.rpc("mark_thread_read", { requested_lead_id: leadId });
  } catch {
    // Ignored.
  }

  return (data as MessageRow[]).map((row) => ({
    authorType: row.author_type,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
  }));
}

/** Unread message counts per lead, for badges in a list view. */
export async function getUnreadCounts(
  leadIds: readonly string[],
  side: "customer" | "vendor",
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (leadIds.length === 0) return counts;

  const supabase = await createClient();
  const column =
    side === "customer" ? "read_by_customer_at" : "read_by_vendor_at";
  const otherSide = side === "customer" ? "vendor" : "customer";

  const { data, error } = await supabase
    .from("lead_messages")
    .select("lead_id")
    .in("lead_id", leadIds as string[])
    .eq("author_type", otherSide)
    .is(column, null)
    .limit(1000);

  if (error || !data) return counts;

  for (const row of data as Array<{ lead_id: string }>) {
    counts.set(row.lead_id, (counts.get(row.lead_id) ?? 0) + 1);
  }
  return counts;
}
