import type { Metadata } from "next";
import Link from "next/link";
import { Heart, MessageCircle, Settings } from "lucide-react";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth";
import { formatEventDate, indiaToday } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

type LeadRow = {
  event_date: string;
  id: string;
  listing_id: string;
  message: string;
  status: string;
  listings: { slug: string; title: string } | null;
  reviews: Array<{ id: string; is_published: boolean }>;
};

const STATUS_LABELS: Record<string, string> = {
  contacted: "Vendor has contacted you",
  closed: "Completed",
  new: "Sent — awaiting vendor",
  qualified: "In discussion",
  spam: "Closed as spam",
  viewed: "Seen by vendor",
};

/** Mirrors `submit_review`: closed, or 14 days past the event date. */
function isReviewable(lead: LeadRow) {
  if (lead.status === "spam") return false;
  if (lead.status === "closed") return true;

  const eventDate = new Date(`${lead.event_date}T00:00:00Z`);
  if (Number.isNaN(eventDate.getTime())) return false;
  eventDate.setUTCDate(eventDate.getUTCDate() + 14);
  return eventDate.toISOString().slice(0, 10) <= indiaToday();
}

export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  const viewer = await requireViewer("/account");
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, listing_id, event_date, message, status, listings(title, slug), reviews(id, is_published)",
    )
    .eq("customer_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const leads = (data ?? []) as unknown as LeadRow[];

  return (
    <main className="mx-auto max-w-5xl px-5 py-14 md:px-8" id="main-content">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-brand-text eyebrow">Customer account</p>
          <h1 className="type-page mt-2">Your wedding enquiries</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Signed in as {viewer.email ?? "verified customer"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition"
            href="/shortlist"
          >
            <Heart aria-hidden="true" size={17} /> Shortlist
          </Link>
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition"
            href="/account/settings"
          >
            <Settings aria-hidden="true" size={17} /> Settings
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              className="bg-foreground hover:bg-brand-solid-hover inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white transition"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-7 space-y-3">
        {params.review === "submitted" && (
          <StatusBanner>
            Review submitted. It appears on the vendor’s profile once moderation
            is complete.
          </StatusBanner>
        )}
        {error && (
          <FormAlert>
            Your enquiries could not be loaded. Please refresh the page.
          </FormAlert>
        )}
      </div>

      <section aria-labelledby="enquiries-heading" className="mt-10 space-y-5">
        <h2 className="sr-only" id="enquiries-heading">
          Enquiry history
        </h2>

        {leads.length === 0 && (
          <div className="border-border rounded-[2rem] border border-dashed p-10 text-center">
            <MessageCircle
              aria-hidden="true"
              className="text-brand-text mx-auto"
            />
            <h3 className="type-heading mt-4">No enquiries yet</h3>
            <p className="text-muted-foreground mt-3">
              Contact an approved live vendor to start a private conversation.
            </p>
            <Link
              className="bg-brand-solid hover:bg-brand-solid-hover mt-6 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-white transition"
              href="/vendors"
            >
              Explore vendors
            </Link>
          </div>
        )}

        {leads.map((lead) => {
          const reviewed = lead.reviews.length > 0;
          const vendorName = lead.listings?.title ?? "this vendor";

          return (
            <article
              className="border-border shadow-soft rounded-[2rem] border bg-white p-6"
              key={lead.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </p>
                  <h3 className="type-heading mt-2">
                    {lead.listings ? (
                      <Link
                        className="hover:text-brand-text transition"
                        href={`/vendor/${lead.listings.slug}`}
                      >
                        {lead.listings.title}
                      </Link>
                    ) : (
                      "Vendor enquiry"
                    )}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Event date: {formatEventDate(lead.event_date)}
                  </p>
                </div>
                <Link
                  className="bg-foreground hover:bg-brand-solid-hover inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white transition"
                  href={`/account/enquiries/${lead.id}`}
                >
                  View contact details
                </Link>
              </div>

              <p className="text-muted-foreground mt-5 line-clamp-3 text-sm leading-6 whitespace-pre-wrap">
                {lead.message}
              </p>

              {reviewed ? (
                <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-sm">
                  {lead.reviews[0]?.is_published
                    ? "Your review is published on this vendor’s profile."
                    : "Your review is awaiting moderation."}
                </p>
              ) : isReviewable(lead) ? (
                <ReviewForm leadId={lead.id} vendorName={vendorName} />
              ) : (
                <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-sm">
                  You can review {vendorName} once the vendor marks this enquiry
                  complete, or 14 days after the event date.
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
