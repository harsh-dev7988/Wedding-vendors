import type { Metadata } from "next";

import { requireViewer } from "@/lib/auth";

import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply as a vendor",
  robots: { index: false, follow: false },
};

export default async function VendorApplicationPage() {
  const viewer = await requireViewer("/for-vendors/apply");

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-8" id="main-content">
      <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
        Vendor application
      </p>
      <h1 className="mt-3 text-5xl font-bold">Tell us about your business.</h1>
      <p className="text-muted-foreground mt-5 max-w-2xl leading-7">
        This creates a private vendor workspace. Listings stay unpublished until
        moderation is complete.
      </p>

      <ApplyForm defaultEmail={viewer.email} />
    </main>
  );
}
