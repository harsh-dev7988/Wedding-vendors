import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AtSign, Phone, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/messaging/message-thread";
import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth";
import { formatEventDate, formatIndiaDateTime } from "@/lib/datetime";
import { loadThread } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Enquiry contact",
  robots: { index: false, follow: false },
};

type ContactRow = {
  email_address: string | null;
  lead_id: string;
  phone: string | null;
  revealed_at: string;
  view_count: number;
  whatsapp: string | null;
};

type LeadRow = {
  event_date: string;
  message: string;
  status: string;
  listings: { slug: string; title: string } | null;
};

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: PageProps<"/account/enquiries/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer(`/account/enquiries/${id}`);
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: leadData }, { data: contactData }] = await Promise.all([
    supabase
      .from("leads")
      .select("event_date, message, status, listings(title, slug)")
      .eq("id", id)
      // RLS already scopes this, but an explicit ownership predicate means a
      // future policy edit cannot silently turn this route into an IDOR.
      .eq("customer_id", viewer.id)
      .maybeSingle(),
    supabase.rpc("get_revealed_contact", { requested_lead_id: id }),
  ]);

  if (!leadData) notFound();

  const lead = leadData as unknown as LeadRow;
  const contact = (
    Array.isArray(contactData) ? contactData[0] : contactData
  ) as ContactRow | undefined;
  const messages = await loadThread(id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/account"
      >
        <ArrowLeft aria-hidden="true" size={16} /> All enquiries
      </Link>

      {query.created === "1" && (
        <StatusBanner className="mt-7">
          Enquiry sent and contact access recorded.
        </StatusBanner>
      )}

      <p className="text-brand-text mt-9 text-sm font-bold tracking-[0.16em] uppercase">
        Private contact
      </p>
      <h1 className="mt-3 text-5xl font-bold">
        {lead.listings?.title ?? "Vendor contact"}
      </h1>
      <p className="text-muted-foreground mt-4">
        Event date: {formatEventDate(lead.event_date)}
      </p>

      <section
        aria-labelledby="contact-heading"
        className="border-border shadow-warm mt-9 rounded-[2rem] border bg-white p-7"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="text-success" />
          <h2 className="text-2xl font-bold" id="contact-heading">
            Revealed for this enquiry
          </h2>
        </div>

        {contact ? (
          <div className="mt-6 grid gap-3">
            {contact.phone && (
              <a
                className="bg-muted hover:bg-brand-soft flex min-h-14 items-center gap-3 rounded-2xl p-4 font-bold transition"
                href={`tel:${contact.phone}`}
              >
                <Phone
                  aria-hidden="true"
                  className="text-brand-text"
                  size={19}
                />
                {contact.phone}
              </a>
            )}
            {contact.email_address && (
              <a
                className="bg-muted hover:bg-brand-soft flex min-h-14 items-center gap-3 rounded-2xl p-4 font-bold break-all transition"
                href={`mailto:${contact.email_address}`}
              >
                <AtSign
                  aria-hidden="true"
                  className="text-brand-text"
                  size={19}
                />
                {contact.email_address}
              </a>
            )}
            {contact.whatsapp && (
              <a
                className="bg-muted hover:bg-brand-soft flex min-h-14 items-center gap-3 rounded-2xl p-4 font-bold transition"
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Phone aria-hidden="true" className="text-success" size={19} />
                WhatsApp {contact.whatsapp}
              </a>
            )}
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              Released {formatIndiaDateTime(contact.revealed_at)} (IST). Opened{" "}
              {contact.view_count} {contact.view_count === 1 ? "time" : "times"}{" "}
              — every access is recorded. Please do not redistribute these
              details.
            </p>
          </div>
        ) : (
          <FormAlert className="mt-5">
            Contact details are unavailable. The vendor may have removed or
            changed their private contact details.
          </FormAlert>
        )}
      </section>

      <div className="mt-7">
        <MessageThread
          counterpartyLabel={lead.listings?.title ?? "the vendor"}
          disabledReason={
            lead.status === "spam"
              ? "This enquiry was closed, so the conversation is no longer active."
              : undefined
          }
          leadId={id}
          messages={messages}
          returnTo={`/account/enquiries/${id}`}
          viewerType="customer"
        />
      </div>

      <section
        aria-labelledby="your-message-heading"
        className="border-border mt-7 rounded-3xl border p-6"
      >
        <h2 className="font-bold" id="your-message-heading">
          Your message
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-wrap">
          {lead.message}
        </p>
      </section>
    </main>
  );
}
