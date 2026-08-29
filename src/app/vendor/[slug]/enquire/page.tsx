import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { getLiveVendorBySlug } from "@/data/live-marketplace";
import { requireViewer } from "@/lib/auth";
import { indiaToday } from "@/lib/datetime";

import { EnquiryForm } from "./enquiry-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Send an enquiry",
  robots: { index: false, follow: false },
};

export default async function EnquiryPage({
  params,
}: PageProps<"/vendor/[slug]/enquire">) {
  const { slug } = await params;
  await requireViewer(`/vendor/${slug}/enquire`);

  // Preview fixtures have no live listing, so this route 404s for them and the
  // enquiry path cannot be reached at all.
  const vendor = await getLiveVendorBySlug(slug);
  if (!vendor?.listingId) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href={`/vendor/${slug}`}
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to {vendor.name}
      </Link>
      <p className="text-brand-text eyebrow mt-8">Validated enquiry</p>
      <h1 className="type-page mt-3">Share your wedding requirements.</h1>
      <p className="text-muted-foreground mt-5 leading-7">
        Once the enquiry is accepted, this account can view {vendor.name}’s
        private phone and email. The vendor receives your event details in their
        lead inbox and will contact you using the details you share in the
        message below.
      </p>

      <EnquiryForm
        listingId={vendor.listingId}
        minDate={indiaToday()}
        slug={slug}
      />
    </main>
  );
}
