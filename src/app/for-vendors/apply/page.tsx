import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply as a vendor",
  robots: { index: false, follow: false },
};

export default async function VendorApplicationPage() {
  const viewer = await requireViewer("/for-vendors/apply");

  /**
   * This page used to hand an application form to anyone who reached it,
   * including people who already had a business. Combined with a header that
   * told every vendor to "list your business", that produced duplicate
   * businesses: a vendor wanting a second *listing* registered a second
   * *company*, which then sat in the moderation queue owning nothing.
   */
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendors(business_name, status)")
    .limit(5);

  const businesses = (memberships ?? [])
    .map(
      (row) =>
        (
          row as unknown as {
            vendors: { business_name: string; status: string };
          }
        ).vendors,
    )
    .filter(Boolean);

  // Already trading: they wanted a listing, not a company.
  if (businesses.some((business) => business.status === "approved")) {
    redirect("/vendor/dashboard/listings?notice=already-a-vendor");
  }

  const pending = businesses.find(
    (business) => business.status === "pending_review",
  );

  if (pending) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 md:px-8" id="main-content">
        <p className="text-brand-text eyebrow">Vendor application</p>
        <h1 className="type-display mt-3">We are reviewing your business.</h1>
        <div className="border-border shadow-soft mt-8 rounded-[2rem] border bg-white p-7">
          <p className="flex items-center gap-2.5 text-sm font-bold">
            <Clock aria-hidden="true" className="text-brand-text" size={18} />
            {pending.business_name} — awaiting moderation
          </p>
          <p className="text-muted-foreground mt-4 leading-7">
            A moderator checks that the business is real and that the contact
            details belong to it. That is a one-time check; once it passes, new
            listings only need their own content reviewed.
          </p>
          <p className="text-muted-foreground mt-4 leading-7">
            You can prepare a listing now — it stays private until the business
            is approved.
          </p>
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover motion-lift mt-7 inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white"
            href="/vendor/dashboard/listings"
          >
            Prepare your first listing
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Vendor application</p>
      <h1 className="type-display mt-3">Tell us about your business.</h1>
      <p className="text-muted-foreground mt-5 max-w-2xl leading-7">
        This creates a private vendor workspace. One business can hold several
        listings, so you only do this once — afterwards you add listings from
        your dashboard. Listings stay unpublished until moderation is complete.
      </p>

      <ApplyForm defaultEmail={viewer.email} />
    </main>
  );
}
