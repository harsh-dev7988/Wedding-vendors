import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";

import { requireViewer } from "@/lib/auth";
import { formatEventDate, formatIndiaDateTime } from "@/lib/datetime";
import { getUnreadCounts } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

type LeadRow = {
  created_at: string;
  event_date: string;
  guest_count: number | null;
  id: string;
  listing_id: string;
  message: string;
  status: string;
};

const STATUS_ORDER = [
  "new",
  "viewed",
  "contacted",
  "qualified",
  "closed",
  "spam",
] as const;

const STATUS_LABEL: Record<string, string> = {
  closed: "Completed",
  contacted: "Contacted",
  new: "New",
  qualified: "Qualified",
  spam: "Spam",
  viewed: "Viewed",
};

export default async function VendorLeadsPage({
  searchParams,
}: PageProps<"/vendor/dashboard/leads">) {
  const viewer = await requireViewer("/vendor/dashboard/leads");
  const params = await searchParams;
  const activeStatus =
    typeof params.status === "string" &&
    STATUS_ORDER.includes(params.status as never)
      ? params.status
      : null;

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendor_id")
    .eq("user_id", viewer.id);

  const vendorIds = (memberships ?? []).map((row) => row.vendor_id as string);

  const { data: listingRows } = vendorIds.length
    ? await supabase
        .from("listings")
        .select("id, title")
        .in("vendor_id", vendorIds)
    : { data: [] };

  const listings = (listingRows ?? []) as Array<{ id: string; title: string }>;
  const listingIds = listings.map((item) => item.id);
  const titleById = new Map(listings.map((item) => [item.id, item.title]));

  let leads: LeadRow[] = [];
  if (listingIds.length) {
    let query = supabase
      .from("leads")
      .select(
        "id, listing_id, event_date, guest_count, message, status, created_at",
      )
      .in("listing_id", listingIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (activeStatus) query = query.eq("status", activeStatus);
    const { data } = await query;
    leads = (data ?? []) as LeadRow[];
  }

  // One query for all badges rather than one per row.
  const unread = await getUnreadCounts(
    leads.map((lead) => lead.id),
    "vendor",
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 md:px-8" id="main-content">
      <div className="flex items-center gap-3">
        <Inbox aria-hidden="true" className="text-brand-text" />
        <h1 className="type-title">Lead inbox</h1>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        {leads.length} {leads.length === 1 ? "enquiry" : "enquiries"}
        {activeStatus ? ` with status “${STATUS_LABEL[activeStatus]}”` : ""}.
      </p>

      <nav aria-label="Filter leads by status" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              aria-current={activeStatus ? undefined : "page"}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold transition ${
                activeStatus
                  ? "border-border hover:border-brand-text/50"
                  : "border-brand-text bg-brand-soft text-brand-text"
              }`}
              href="/vendor/dashboard/leads"
            >
              All
            </Link>
          </li>
          {STATUS_ORDER.map((status) => (
            <li key={status}>
              <Link
                aria-current={activeStatus === status ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold transition ${
                  activeStatus === status
                    ? "border-brand-text bg-brand-soft text-brand-text"
                    : "border-border hover:border-brand-text/50"
                }`}
                href={`/vendor/dashboard/leads?status=${status}`}
              >
                {STATUS_LABEL[status]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {leads.length === 0 ? (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-10 text-center text-sm">
          {vendorIds.length === 0
            ? "You do not manage a business yet."
            : activeStatus
              ? "No enquiries with that status."
              : "Validated customer enquiries will appear here."}
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {leads.map((lead) => {
            const unreadCount = unread.get(lead.id) ?? 0;
            return (
              <li key={lead.id}>
                <Link
                  className="border-border hover:border-brand-text/40 block rounded-2xl border bg-white p-5 transition"
                  href={`/vendor/dashboard/leads/${lead.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {titleById.get(lead.listing_id) ?? "Listing enquiry"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Event {formatEventDate(lead.event_date)}
                        {lead.guest_count
                          ? ` · ${lead.guest_count} guests`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="bg-brand-solid inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white">
                          <MessageSquare aria-hidden="true" size={12} />
                          {unreadCount}
                          <span className="sr-only">unread messages</span>
                        </span>
                      )}
                      <span className="bg-muted rounded-full px-3 py-1 text-xs font-bold uppercase">
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-6">
                    {lead.message}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Received {formatIndiaDateTime(lead.created_at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
