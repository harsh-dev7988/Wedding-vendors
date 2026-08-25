import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import { RatingStars } from "@/components/ui/rating";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { ReplyForm } from "./reply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

type ReviewRow = {
  body: string;
  created_at: string;
  id: string;
  is_published: boolean;
  listing_id: string;
  rating: number;
  vendor_reply: string | null;
};

export default async function VendorReviewsPage() {
  const viewer = await requireViewer("/vendor/dashboard/reviews");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendor_id, role")
    .eq("user_id", viewer.id);

  const rows = (memberships ?? []) as Array<{
    role: string;
    vendor_id: string;
  }>;
  const vendorIds = rows.map((row) => row.vendor_id);
  // The `vendors reply to reviews` policy accepts owner, manager and
  // lead_manager. An editor sees the reviews but gets no reply box.
  const canReply = rows.some((row) =>
    ["owner", "manager", "lead_manager"].includes(row.role),
  );

  const { data: listingRows } = vendorIds.length
    ? await supabase
        .from("listings")
        .select("id, title, slug")
        .in("vendor_id", vendorIds)
    : { data: [] };

  const listings = (listingRows ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  const listingById = new Map(listings.map((item) => [item.id, item]));

  const { data: reviewRows } = listings.length
    ? await supabase
        .from("reviews")
        .select(
          "id, listing_id, rating, body, vendor_reply, is_published, created_at",
        )
        .in(
          "listing_id",
          listings.map((item) => item.id),
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  const reviews = (reviewRows ?? []) as ReviewRow[];
  const published = reviews.filter((review) => review.is_published);
  const unanswered = published.filter((review) => !review.vendor_reply);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:px-8" id="main-content">
      <div className="flex items-center gap-3">
        <MessageSquareText aria-hidden="true" className="text-brand-text" />
        <h1 className="type-title">Reviews</h1>
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        {published.length} published
        {unanswered.length > 0 ? ` · ${unanswered.length} without a reply` : ""}
        . Reviews come only from customers who sent an enquiry through the
        marketplace, and are moderated before publication.
      </p>

      {reviews.length === 0 ? (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-10 text-center text-sm">
          No reviews yet. They appear once customers complete a booking.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {reviews.map((review) => {
            const listing = listingById.get(review.listing_id);
            return (
              <li
                className="border-border rounded-3xl border bg-white p-6"
                key={review.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <RatingStars value={review.rating} />
                  <span className="text-muted-foreground text-xs font-bold uppercase">
                    {review.is_published ? "Published" : "Awaiting moderation"}
                  </span>
                </div>

                {listing && (
                  <p className="text-brand-text mt-2 text-sm font-bold">
                    <Link
                      className="hover:underline"
                      href={`/vendor/${listing.slug}`}
                    >
                      {listing.title}
                    </Link>
                  </p>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatIndiaDateTime(review.created_at)}
                </p>

                <p className="mt-3 leading-7 whitespace-pre-wrap">
                  {review.body}
                </p>

                {review.is_published && canReply ? (
                  <ReplyForm
                    existingReply={review.vendor_reply}
                    reviewId={review.id}
                  />
                ) : review.vendor_reply ? (
                  <div className="bg-muted mt-4 rounded-2xl p-4">
                    <p className="text-xs font-bold tracking-wider uppercase">
                      Your reply
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">
                      {review.vendor_reply}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-xs">
                    {review.is_published
                      ? "Your role on this business does not allow replying."
                      : "You can reply once a moderator publishes this review."}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
