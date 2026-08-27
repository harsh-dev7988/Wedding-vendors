import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";

import { StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

type NotificationRow = {
  body: string | null;
  created_at: string;
  id: string;
  kind: string;
  read_at: string | null;
  title: string;
  url: string | null;
};

const KIND_LABELS: Record<string, string> = {
  lead_created: "New enquiry",
  listing_published: "Listing published",
  listing_rejected: "Changes requested",
  listing_suspended: "Listing suspended",
  message_received: "Message",
  payment_captured: "Payment",
  review_published: "Review published",
  vendor_approved: "Business approved",
  vendor_suspended: "Business suspended",
};

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/account/notifications">) {
  const viewer = await requireViewer("/account/notifications");
  const params = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, url, read_at, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as NotificationRow[];
  const unread = notifications.filter((item) => item.read_at === null).length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/account"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to your enquiries
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-text eyebrow">Account</p>
          <h1 className="type-display mt-2">Notifications</h1>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <SubmitButton
              className="border-border hover:border-brand-text/50 min-h-11 rounded-full border bg-white px-4 text-sm"
              pendingLabel="Marking…"
            >
              <CheckCheck aria-hidden="true" size={16} /> Mark all read
            </SubmitButton>
          </form>
        )}
      </div>

      {params.marked === "1" && (
        <StatusBanner className="mt-6">
          All notifications marked as read.
        </StatusBanner>
      )}

      {notifications.length === 0 ? (
        <div className="border-border mt-10 rounded-[2rem] border border-dashed p-10 text-center">
          <Bell aria-hidden="true" className="text-brand-text mx-auto" />
          <h2 className="type-heading mt-4">Nothing yet</h2>
          <p className="text-muted-foreground mt-3">
            Enquiries, replies and moderation decisions will appear here.
          </p>
        </div>
      ) : (
        <ol className="mt-8 space-y-3">
          {notifications.map((item) => {
            // The database constrains `url` to an internal path, and this
            // re-checks before rendering it as a link.
            const href = item.url ? safeInternalPath(item.url) : null;
            const unreadItem = item.read_at === null;

            const content = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {unreadItem && (
                    <span
                      aria-hidden="true"
                      className="bg-brand-solid inline-block size-2 shrink-0 rounded-full"
                    />
                  )}
                  <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    {KIND_LABELS[item.kind] ?? item.kind.replaceAll("_", " ")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatIndiaDateTime(item.created_at)}
                  </span>
                  {unreadItem && <span className="sr-only">Unread</span>}
                </div>
                <p className="mt-2 font-bold">{item.title}</p>
                {item.body && (
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {item.body}
                  </p>
                )}
              </>
            );

            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    className={`hover:border-brand-text/40 block rounded-2xl border p-5 transition ${
                      unreadItem
                        ? "border-brand-text/25 bg-brand-soft/40"
                        : "border-border bg-white"
                    }`}
                    href={href}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={`rounded-2xl border p-5 ${
                      unreadItem
                        ? "border-brand-text/25 bg-brand-soft/40"
                        : "border-border bg-white"
                    }`}
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
