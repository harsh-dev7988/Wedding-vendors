import type { Metadata } from "next";
import {
  ArrowRight,
  ClipboardCheck,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { RatingStars } from "@/components/ui/rating";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { moderateListing, moderateReview, moderateVendor } from "./actions";
import { ModerationForm } from "./moderation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Marketplace moderation",
  robots: { index: false, follow: false },
};

type VendorRow = {
  business_name: string;
  created_at: string;
  id: string;
  status: string;
  verification_expires_at: string | null;
};

type ListingRow = {
  id: string;
  status: string;
  summary: string;
  title: string;
  vendors: { business_name: string; status: string } | null;
};

type ReviewRow = {
  body: string;
  created_at: string;
  id: string;
  is_published: boolean;
  listings: { title: string } | null;
  rating: number;
};

const VENDOR_ACTIONS = {
  approved: [{ label: "Suspend", value: "suspend", destructive: true }],
  pending_review: [
    { label: "Approve for 12 months", value: "approve" },
    { label: "Suspend", value: "suspend", destructive: true },
  ],
  suspended: [{ label: "Reinstate", value: "reinstate" }],
} as const;

const LISTING_ACTIONS = {
  pending_review: [
    { label: "Publish", value: "publish" },
    { label: "Return for changes", value: "reject", destructive: true },
  ],
  published: [{ label: "Suspend", value: "suspend", destructive: true }],
  rejected: [{ label: "Publish", value: "publish" }],
  suspended: [{ label: "Publish", value: "publish" }],
} as const;

function EmptySection({ children }: { children: string }) {
  return (
    <p className="border-border text-muted-foreground rounded-3xl border border-dashed p-8 text-sm">
      {children}
    </p>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireViewer("/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const params = await searchParams;

  // Suspended vendors and rejected listings are included: filtering them out
  // made both states permanent dead ends with no route back.
  const [
    { data: vendorData },
    { data: listingData },
    { data: reviewData },
    { data: expiredData },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, business_name, status, verification_expires_at, created_at")
      .in("status", ["pending_review", "approved", "suspended"])
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("listings")
      .select("id, title, summary, status, vendors(business_name, status)")
      .in("status", ["pending_review", "published", "rejected", "suspended"])
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("reviews")
      .select("id, rating, body, is_published, created_at, listings(title)")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.rpc("list_expired_verifications"),
  ]);

  const vendors = (vendorData ?? []) as unknown as VendorRow[];
  const listings = (listingData ?? []) as unknown as ListingRow[];
  const reviews = (reviewData ?? []) as unknown as ReviewRow[];
  // Evaluated in the database so the render stays pure and the boundary
  // matches the one the badge uses.
  const expiredVendorIds = new Set(
    ((expiredData ?? []) as Array<{ vendor_id: string }>).map(
      (row) => row.vendor_id,
    ),
  );

  const pendingVendors = vendors.filter((v) => v.status === "pending_review");
  const pendingListings = listings.filter((l) => l.status === "pending_review");
  const pendingReviews = reviews.filter((r) => !r.is_published);
  const updated = typeof params.updated === "string" ? params.updated : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Operations</p>
      <h1 className="type-page mt-2">Marketplace moderation</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Approve identity-checked businesses, inspect complete listings, and
        publish only eligible reviews. Every control passes through a
        database-side administrator check, and every decision is written to the
        audit log.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Vendors awaiting review", value: pendingVendors.length },
          { label: "Listings in moderation", value: pendingListings.length },
          {
            label: "Reviews awaiting moderation",
            value: pendingReviews.length,
          },
        ].map((stat) => (
          <div
            className="border-border rounded-2xl border bg-white p-5"
            key={stat.label}
          >
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {stat.label}
            </dt>
            <dd className="mt-2 text-3xl font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 space-y-3">
        {updated && <StatusBanner>Moderation state updated.</StatusBanner>}
        {errorMessage && <FormAlert>{errorMessage}</FormAlert>}
      </div>

      <section aria-labelledby="vendor-heading" className="mt-12">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="text-brand-text" />
          <h2 className="type-title" id="vendor-heading">
            Vendor verification
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {vendors.length === 0 && (
            <EmptySection>No vendor applications yet.</EmptySection>
          )}
          {vendors.map((vendor) => {
            const expired = expiredVendorIds.has(vendor.id);

            return (
              <article
                className="border-border shadow-soft rounded-3xl border bg-white p-6"
                key={vendor.id}
              >
                <p className="text-muted-foreground text-xs font-bold uppercase">
                  {vendor.status.replaceAll("_", " ")}
                </p>
                <h3 className="type-heading mt-2">
                  <Link
                    className="hover:text-brand-text transition"
                    href={`/admin/vendors/${vendor.id}`}
                  >
                    {vendor.business_name}
                  </Link>
                </h3>
                {vendor.verification_expires_at && (
                  <p
                    className={`mt-2 text-sm ${expired ? "text-brand-text font-bold" : "text-muted-foreground"}`}
                  >
                    {expired ? "Verification expired " : "Verified until "}
                    {formatIndiaDateTime(vendor.verification_expires_at)}
                    {expired && " — re-approve to restore the badge."}
                  </p>
                )}
                <ModerationForm
                  action={moderateVendor}
                  actions={
                    VENDOR_ACTIONS[
                      vendor.status as keyof typeof VENDOR_ACTIONS
                    ] ?? []
                  }
                  entityId={vendor.id}
                  entityLabel={vendor.business_name}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="listing-heading" className="mt-14">
        <div className="flex items-center gap-3">
          <ClipboardCheck aria-hidden="true" className="text-brand-text" />
          <h2 className="type-title" id="listing-heading">
            Listing review
          </h2>
        </div>
        <div className="mt-6 space-y-4">
          {listings.length === 0 && (
            <EmptySection>No listings have been created yet.</EmptySection>
          )}
          {listings.map((listing) => (
            <article
              className="border-border rounded-3xl border bg-white p-6"
              key={listing.id}
            >
              <p className="text-muted-foreground text-xs font-bold uppercase">
                {listing.status.replaceAll("_", " ")} ·{" "}
                {listing.vendors?.business_name}
                {listing.vendors?.status !== "approved" && (
                  <span className="text-brand-text">
                    {" "}
                    · vendor not approved
                  </span>
                )}
              </p>
              <h3 className="type-heading mt-2">
                <Link
                  className="hover:text-brand-text transition"
                  href={`/admin/listings/${listing.id}`}
                >
                  {listing.title}
                </Link>
              </h3>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {listing.summary}
              </p>
              <Link
                className="text-brand-text mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
                href={`/admin/listings/${listing.id}`}
              >
                Open full review — images, content and reports
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
              <ModerationForm
                action={moderateListing}
                actions={
                  LISTING_ACTIONS[
                    listing.status as keyof typeof LISTING_ACTIONS
                  ] ?? []
                }
                entityId={listing.id}
                entityLabel={listing.title}
              />
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="review-heading" className="mt-14">
        <div className="flex items-center gap-3">
          <MessageSquareText aria-hidden="true" className="text-brand-text" />
          <h2 className="type-title" id="review-heading">
            Review moderation
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.length === 0 && (
            <EmptySection>No reviews have been submitted yet.</EmptySection>
          )}
          {reviews.map((review) => (
            <article
              className="border-border rounded-3xl border bg-white p-6"
              key={review.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RatingStars value={review.rating} />
                <span className="text-muted-foreground text-xs font-bold uppercase">
                  {review.is_published ? "Published" : "Awaiting moderation"}
                </span>
              </div>
              <p className="text-brand-text mt-2 text-sm font-bold">
                {review.listings?.title}
              </p>
              <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-wrap">
                {review.body}
              </p>
              <ModerationForm
                action={moderateReview}
                actions={
                  review.is_published
                    ? [{ label: "Hide", value: "hide", destructive: true }]
                    : [{ label: "Publish", value: "publish" }]
                }
                entityId={review.id}
                entityLabel={review.listings?.title ?? "this review"}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
