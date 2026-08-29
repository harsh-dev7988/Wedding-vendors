import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/messaging/message-thread";
import { SelectMenu } from "@/components/ui/select-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireViewer } from "@/lib/auth";
import { formatEventDate, formatIndiaDateTime } from "@/lib/datetime";
import { loadThread } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/server";

import { updateLeadStatus } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Enquiry",
  robots: { index: false, follow: false },
};

type LeadDetail = {
  created_at: string;
  event_date: string;
  first_vendor_response_at: string | null;
  guest_count: number | null;
  id: string;
  listings: { slug: string; title: string; vendor_id: string } | null;
  message: string;
  status: string;
};

/** Shared so both places a lead status is set look identical. */
const LEAD_STATUS_CLASS =
  "border-border focus-within:border-brand-text min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium transition";

const LEAD_STATUSES = [
  { label: "Viewed", value: "viewed" },
  { label: "Contacted", value: "contacted" },
  { label: "Qualified", value: "qualified" },
  { label: "Completed / closed", value: "closed" },
  { label: "Spam", value: "spam" },
] as const;

export default async function VendorLeadPage({
  params,
}: PageProps<"/vendor/dashboard/leads/[id]">) {
  await requireViewer("/vendor/dashboard");
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes this to leads on a listing the viewer's business owns.
  const { data } = await supabase
    .from("leads")
    .select(
      "id, event_date, guest_count, message, status, created_at, first_vendor_response_at, listings(title, slug, vendor_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const lead = data as unknown as LeadDetail;

  // Confirms the viewer is on the vendor side rather than the customer side,
  // so a customer opening this URL gets a 404 instead of the vendor view.
  const { data: role } = await supabase.rpc("lead_participant_role", {
    check_lead_id: id,
  });
  if (role !== "vendor") notFound();

  const messages = await loadThread(id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/vendor/dashboard"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to the dashboard
      </Link>

      <p className="text-brand-text eyebrow mt-6">Enquiry · {lead.status}</p>
      <h1 className="type-title mt-2 md:text-5xl">
        {lead.listings?.title ?? "Listing enquiry"}
      </h1>

      <dl className="border-border mt-6 grid gap-4 rounded-3xl border bg-white p-6 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            <CalendarDays
              aria-hidden="true"
              className="mr-1 inline"
              size={13}
            />
            Event date
          </dt>
          <dd className="mt-1 font-bold">{formatEventDate(lead.event_date)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            <Users aria-hidden="true" className="mr-1 inline" size={13} />{" "}
            Guests
          </dt>
          <dd className="mt-1 font-bold">{lead.guest_count ?? "Not given"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Received
          </dt>
          <dd className="mt-1 font-bold">
            {formatIndiaDateTime(lead.created_at)}
          </dd>
        </div>
      </dl>

      <section
        aria-labelledby="original-heading"
        className="border-border mt-6 rounded-3xl border p-6"
      >
        <h2 className="font-bold" id="original-heading">
          Original enquiry
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-wrap">
          {lead.message}
        </p>
      </section>

      <div className="mt-6">
        <MessageThread
          counterpartyLabel="the customer"
          disabledReason={
            lead.status === "spam"
              ? "This enquiry is marked as spam, so the conversation is closed."
              : undefined
          }
          leadId={lead.id}
          messages={messages}
          returnTo={`/vendor/dashboard/leads/${lead.id}`}
          viewerType="vendor"
        />
      </div>

      <section
        aria-labelledby="status-heading"
        className="border-border mt-6 rounded-3xl border bg-white p-6"
      >
        <h2 className="font-bold" id="status-heading">
          Lead status
        </h2>
        <form
          action={updateLeadStatus}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <input name="leadId" type="hidden" value={lead.id} />
          <label
            className="grid flex-1 gap-1 text-xs font-bold"
            htmlFor="lead-status"
          >
            Current stage
            <SelectMenu
              className={LEAD_STATUS_CLASS}
              id="lead-status"
              label="Lead status"
              name="status"
              options={LEAD_STATUSES.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              value={lead.status === "new" ? "viewed" : lead.status}
            />
          </label>
          <SubmitButton
            className="bg-foreground hover:bg-brand-solid-hover min-h-11 rounded-xl px-4 text-sm text-white"
            pendingLabel="Updating…"
          >
            Update
          </SubmitButton>
        </form>
        <p className="text-muted-foreground mt-3 text-xs leading-5">
          Replying moves a new enquiry to “contacted” automatically. Marking it
          complete lets the customer leave a review — they can also review 14
          days after the event date.
        </p>
      </section>
    </main>
  );
}
