import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { FormAlert } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

import { moderateVendor } from "../../actions";
import { ModerationForm } from "../../moderation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review vendor",
  robots: { index: false, follow: false },
};

const ACTIONS = {
  approved: [{ label: "Suspend", value: "suspend", destructive: true }],
  archived: [{ label: "Reinstate", value: "reinstate" }],
  draft: [
    { label: "Approve for 12 months", value: "approve" },
    { label: "Suspend", value: "suspend", destructive: true },
  ],
  pending_review: [
    { label: "Approve for 12 months", value: "approve" },
    { label: "Suspend", value: "suspend", destructive: true },
  ],
  suspended: [{ label: "Reinstate", value: "reinstate" }],
} as const;

type VendorDetail = {
  business_name: string;
  created_at: string;
  id: string;
  legal_name: string | null;
  moderated_at: string | null;
  moderation_note: string | null;
  status: string;
  verification_expires_at: string | null;
  verified_at: string | null;
};

export default async function AdminVendorDetailPage({
  params,
}: PageProps<"/admin/vendors/[id]">) {
  await requireViewer("/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const { id } = await params;

  const { data } = await supabase
    .from("vendors")
    .select(
      // `legal_name`, `moderated_at` and `moderation_note` are granted to no
      // client role — `vendors` is world-readable for any approved business,
      // so a moderator note would be public. Naming them here made PostgREST
      // refuse the request and this page 404 for every vendor.
      "id, business_name, status, verified_at, verification_expires_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  // The private half comes from a definer RPC restricted to members and admins.
  const { data: privateRows } = await supabase.rpc(
    "get_vendor_private_details",
    { requested_vendor_ids: [id] },
  );
  const priv = (privateRows ?? [])[0] as
    | {
        legal_name: string | null;
        moderated_at: string | null;
        moderation_note: string | null;
      }
    | undefined;
  const vendor = {
    ...(data as unknown as Omit<
      VendorDetail,
      "legal_name" | "moderated_at" | "moderation_note"
    >),
    legal_name: priv?.legal_name ?? null,
    moderated_at: priv?.moderated_at ?? null,
    moderation_note: priv?.moderation_note ?? null,
  } as VendorDetail;

  // Admins can read `vendor_contacts` under the `members read contacts`
  // policy. Verifying a business without seeing its contact details was
  // impossible before this page existed.
  const [
    { data: contact },
    { data: listingRows },
    { data: docRows },
    { data: memberRows },
  ] = await Promise.all([
    supabase
      .from("vendor_contacts")
      .select("phone_e164, email, whatsapp_e164, updated_at")
      .eq("vendor_id", id)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id, title, slug, status, rating_count, created_at")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("verification_documents")
      .select(
        "id, kind, storage_path, original_filename, reviewed_at, created_at",
      )
      .eq("vendor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vendor_members")
      .select("user_id, role, created_at")
      .eq("vendor_id", id),
  ]);

  const listings = (listingRows ?? []) as Array<{
    created_at: string;
    id: string;
    rating_count: number;
    slug: string;
    status: string;
    title: string;
  }>;
  const documents = (docRows ?? []) as Array<{
    created_at: string;
    id: string;
    kind: string;
    original_filename: string | null;
    reviewed_at: string | null;
    storage_path: string;
  }>;
  const members = (memberRows ?? []) as Array<{
    created_at: string;
    role: string;
    user_id: string;
  }>;

  // Private bucket: a short-lived signed URL, never a public link.
  const signedDocuments = await Promise.all(
    documents.map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("vendor-verification")
        .createSignedUrl(doc.storage_path, 300);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  const { data: expiredRows } = await supabase.rpc(
    "list_expired_verifications",
  );
  const expired = ((expiredRows ?? []) as Array<{ vendor_id: string }>).some(
    (row) => row.vendor_id === vendor.id,
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/admin"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to moderation
      </Link>

      <p className="text-brand-text eyebrow mt-6">
        {vendor.status.replaceAll("_", " ")}
      </p>
      <h1 className="type-page mt-2">{vendor.business_name}</h1>
      {vendor.legal_name && (
        <p className="text-muted-foreground mt-2">
          Registered as {vendor.legal_name}
        </p>
      )}
      <p className="text-muted-foreground mt-1 text-sm">
        Applied {formatIndiaDateTime(vendor.created_at)}
      </p>

      {expired && (
        <FormAlert className="mt-6">
          Verification expired{" "}
          {formatIndiaDateTime(vendor.verification_expires_at!)}. The verified
          badge is already hidden on public pages; re-approve to restore it.
        </FormAlert>
      )}

      <section aria-labelledby="contact-heading" className="mt-10">
        <div className="flex items-center gap-3">
          <LockKeyhole aria-hidden="true" className="text-brand-text" />
          <h2 className="type-heading" id="contact-heading">
            Private contact details
          </h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Visible to administrators for verification only. These values are
          released to customers exclusively through an audited enquiry reveal.
        </p>
        {contact ? (
          <dl className="border-border mt-4 grid gap-4 rounded-3xl border bg-white p-6 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Phone
              </dt>
              <dd className="mt-1 font-bold">{contact.phone_e164 ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Email
              </dt>
              <dd className="mt-1 font-bold break-all">
                {contact.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                WhatsApp
              </dt>
              <dd className="mt-1 font-bold">{contact.whatsapp_e164 ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <FormAlert className="mt-4">
            No contact row. This business cannot be approved and cannot receive
            enquiries.
          </FormAlert>
        )}
      </section>

      <section aria-labelledby="evidence-heading" className="mt-10">
        <div className="flex items-center gap-3">
          <FileText aria-hidden="true" className="text-brand-text" />
          <h2 className="type-heading" id="evidence-heading">
            Verification evidence ({signedDocuments.length})
          </h2>
        </div>
        {signedDocuments.length === 0 ? (
          <p className="border-border text-muted-foreground mt-4 rounded-3xl border border-dashed p-8 text-sm">
            No documents uploaded. Approving without evidence means the verified
            badge asserts something nobody checked.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {signedDocuments.map((doc) => (
              <li
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-sm"
                key={doc.id}
              >
                <span>
                  <strong>{doc.kind.replaceAll("_", " ")}</strong>
                  {doc.original_filename ? ` · ${doc.original_filename}` : ""}
                  <span className="text-muted-foreground">
                    {" "}
                    · uploaded {formatIndiaDateTime(doc.created_at)}
                    {doc.reviewed_at ? " · reviewed" : ""}
                  </span>
                </span>
                {doc.url ? (
                  <a
                    className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border px-4 font-bold transition"
                    href={doc.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open (expires in 5 min)
                  </a>
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="listings-heading" className="mt-10">
        <h2 className="type-heading" id="listings-heading">
          Listings ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <p className="border-border text-muted-foreground mt-4 rounded-3xl border border-dashed p-8 text-sm">
            No listings yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {listings.map((listing) => (
              <li
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-sm"
                key={listing.id}
              >
                <span>
                  <strong>{listing.title}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · {listing.status.replaceAll("_", " ")} ·{" "}
                    {listing.rating_count} reviews
                  </span>
                </span>
                <Link
                  className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border px-4 font-bold transition"
                  href={`/admin/listings/${listing.id}`}
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="team-heading" className="mt-10">
        <h2 className="type-heading" id="team-heading">
          Team ({members.length})
        </h2>
        <ul className="text-muted-foreground mt-4 space-y-1 text-sm">
          {members.map((member) => (
            <li key={member.user_id}>
              <span className="font-mono text-xs">{member.user_id}</span> ·{" "}
              {member.role} · joined {formatIndiaDateTime(member.created_at)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="decision-heading" className="mt-10">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="text-brand-text" />
          <h2 className="type-heading" id="decision-heading">
            Verification decision
          </h2>
        </div>
        {vendor.moderation_note && (
          <p className="bg-muted mt-3 rounded-2xl p-4 text-sm leading-6">
            <strong>Last note:</strong> {vendor.moderation_note}
            {vendor.moderated_at
              ? ` (${formatIndiaDateTime(vendor.moderated_at)})`
              : ""}
          </p>
        )}
        <p className="text-muted-foreground mt-3 text-sm">
          Suspending takes every published listing offline. Reinstating restores
          only the listings that the suspension took down.
        </p>

        <ModerationForm
          action={moderateVendor}
          actions={ACTIONS[vendor.status as keyof typeof ACTIONS] ?? []}
          entityId={vendor.id}
          entityLabel={vendor.business_name}
        />
      </section>
    </main>
  );
}
