import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";

import { RatingStars } from "@/components/ui/rating";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your reviews",
  robots: { index: false, follow: false },
};

type ReviewRow = {
  body: string;
  created_at: string;
  id: string;
  is_published: boolean;
  listings: { slug: string; title: string } | null;
  rating: number;
  vendor_reply: string | null;
};

export default async function AccountReviewsPage() {
  const viewer = await requireViewer("/account/reviews");
  const supabase = await createClient();

  // RLS scopes reviews to the author, so this returns only the viewer's own —
  // including the ones still awaiting moderation.
  const { data } = await supabase
    .from("reviews")
    .select(
      "id, rating, body, vendor_reply, is_published, created_at, listings(title, slug)",
    )
    .eq("customer_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const reviews = (data ?? []) as unknown as ReviewRow[];
  const pending = reviews.filter((review) => !review.is_published).length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-8" id="main-content">
      <div className="flex items-center gap-3">
        <Star aria-hidden="true" className="text-brand-text" />
        <h1 className="type-title">Your reviews</h1>
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        {reviews.length === 0
          ? "You have not written a review yet."
          : `${reviews.length} written${pending > 0 ? `, ${pending} awaiting moderation` : ""}.`}
      </p>

      {reviews.length === 0 ? (
        <div className="border-border mt-8 rounded-[2rem] border border-dashed p-10 text-center">
          <p className="text-muted-foreground leading-7">
            You can review a vendor once your enquiry is marked complete, or 14
            days after the event date. Reviews from real enquiries are what make
            the ratings here worth reading.
          </p>
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover mt-6 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-white transition"
            href="/account"
          >
            See your enquiries
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reviews.map((review) => (
            <li
              className="border-border rounded-3xl border bg-white p-6"
              key={review.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <RatingStars value={review.rating} />
                <span
                  className={`text-xs font-bold uppercase ${
                    review.is_published
                      ? "text-success"
                      : "text-muted-foreground"
                  }`}
                >
                  {review.is_published ? "Published" : "Awaiting moderation"}
                </span>
              </div>

              {review.listings && (
                <p className="text-brand-text mt-2 text-sm font-bold">
                  <Link
                    className="hover:underline"
                    href={`/vendor/${review.listings.slug}`}
                  >
                    {review.listings.title}
                  </Link>
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {formatIndiaDateTime(review.created_at)}
              </p>

              <p className="mt-3 leading-7 whitespace-pre-wrap">
                {review.body}
              </p>

              {review.vendor_reply && (
                <div className="bg-muted mt-4 rounded-2xl p-4">
                  <p className="text-xs font-bold tracking-wider uppercase">
                    Reply from {review.listings?.title ?? "the vendor"}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">
                    {review.vendor_reply}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
