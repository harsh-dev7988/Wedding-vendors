import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { VendorSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Business settings",
  robots: { index: false, follow: false },
};

type VendorRow = {
  business_name: string;
  id: string;
  legal_name: string | null;
  status: string;
};

type ContactRow = {
  email: string | null;
  phone_e164: string | null;
  vendor_id: string;
  whatsapp_e164: string | null;
};

export default async function VendorSettingsPage() {
  const viewer = await requireViewer("/vendor/dashboard/settings");
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

  const [{ data: vendorRows }, { data: contactRows }] = vendorIds.length
    ? await Promise.all([
        supabase
          .from("vendors")
          .select("id, business_name, legal_name, status")
          .in("id", vendorIds),
        // Readable only by owners and managers under the `members read
        // contacts` policy, so an editor simply sees blank fields.
        supabase
          .from("vendor_contacts")
          .select("vendor_id, phone_e164, email, whatsapp_e164")
          .in("vendor_id", vendorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const vendors = (vendorRows ?? []) as VendorRow[];
  const contacts = new Map(
    ((contactRows ?? []) as ContactRow[]).map((row) => [row.vendor_id, row]),
  );
  const roleByVendor = new Map(rows.map((row) => [row.vendor_id, row.role]));

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/vendor/dashboard"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to the dashboard
      </Link>

      <p className="text-brand-text mt-6 text-sm font-bold tracking-[0.16em] uppercase">
        Business settings
      </p>
      <h1 className="mt-2 text-5xl font-bold">Your business details</h1>

      {vendors.length === 0 ? (
        <p className="text-muted-foreground mt-6 leading-7">
          You do not manage a business yet.{" "}
          <Link className="text-brand-text font-bold" href="/for-vendors/apply">
            Start an application
          </Link>
          .
        </p>
      ) : (
        vendors.map((vendor) => {
          const contact = contacts.get(vendor.id);
          const role = roleByVendor.get(vendor.id) ?? "editor";

          return (
            <section
              aria-labelledby={`settings-${vendor.id}`}
              className="mt-10"
              key={vendor.id}
            >
              <h2 className="text-2xl font-bold" id={`settings-${vendor.id}`}>
                {vendor.business_name}
              </h2>
              <p className="text-muted-foreground mt-1 text-xs font-bold tracking-widest uppercase">
                {vendor.status.replaceAll("_", " ")} · your role: {role}
              </p>

              <VendorSettingsForm
                canEdit={["owner", "manager"].includes(role)}
                defaults={{
                  businessName: vendor.business_name,
                  email: contact?.email ?? "",
                  legalName: vendor.legal_name ?? "",
                  phone: contact?.phone_e164 ?? "",
                  vendorId: vendor.id,
                  whatsapp: contact?.whatsapp_e164 ?? "",
                }}
              />
            </section>
          );
        })
      )}
    </main>
  );
}
