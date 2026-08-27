import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ImageOff } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { FormAlert } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { formatStartingPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { mediaUrlResolver } from "@/lib/supabase/media";

import { moderateListing } from "../../actions";
import { ModerationForm } from "../../moderation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review listing",
  robots: { index: false, follow: false },
};

const ACTIONS = {
  draft: [{ label: "Publish", value: "publish" }],
  pending_review: [
    { label: "Publish", value: "publish" },
    { label: "Return for changes", value: "reject", destructive: true },
  ],
  published: [{ label: "Suspend", value: "suspend", destructive: true }],
  rejected: [{ label: "Publish", value: "publish" }],
  suspended: [{ label: "Publish", value: "publish" }],
} as const;

type ListingDetail = {
  categories: { name: string } | null;
  cities: { name: string } | null;
  created_at: string;
  description: string;
  id: string;
  locality: string | null;
  moderated_at: string | null;
  moderation_note: string | null;
  price_from: number | null;
  price_unit: string;
  published_at: string | null;
  rating_count: number;
  slug: string;
  status: string;
  summary: string;
  title: string;
  vendor_id: string;
  vendors: {
    business_name: string;
    id: string;
    status: string;
    verification_expires_at: string | null;
  } | null;
  years_experience: number | null;
};

export default async function AdminListingDetailPage({
  params,
}: PageProps<"/admin/listings/[id]">) {
  await requireViewer("/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const { id } = await params;

  const { data } = await supabase
    .from("listings")
    .select(
      "id, vendor_id, slug, title, summary, description, locality, price_from, price_unit, years_experience, status, published_at, moderated_at, moderation_note, rating_count, created_at, vendors(id, business_name, status, verification_expires_at), cities(name), categories(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const listing = data as unknown as ListingDetail;

  const [{ data: mediaRows }, { data: reportRows }] = await Promise.all([
    supabase
      .from("listing_media")
      .select("id, storage_path, alt_text, sort_order")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("reports")
      .select("id, reason, detail, status, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const media = (mediaRows ?? []) as Array<{
    alt_text: string;
    id: string;
    storage_path: string;
  }>;
  const reports = (reportRows ?? []) as Array<{
    created_at: string;
    detail: string | null;
    id: string;
    reason: string;
    status: string;
  }>;

  const publicUrl = mediaUrlResolver(supabase, "thumb");

  const { data: locationRows } = await supabase.rpc("get_listing_location", {
    requested_listing_id: listing.id as string,
  });
  const location = (Array.isArray(locationRows) ? locationRows[0] : null) as {
    latitude: number | null;
    longitude: number | null;
    service_radius_m: number | null;
    street_address: string | null;
  } | null;

  const price = formatStartingPrice(
    listing.price_from,
    listing.price_unit.replaceAll("_", " ") as never,
  );
  const vendorApproved = listing.vendors?.status === "approved";
  const openReports = reports.filter((report) => report.status === "open");

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/admin"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to moderation
      </Link>

      <p className="text-brand-text eyebrow mt-6">
        {listing.status.replaceAll("_", " ")}
      </p>
      <h1 className="type-title mt-2 md:text-5xl">{listing.title}</h1>
      <p className="text-muted-foreground mt-3">
        <Link
          className="hover:text-foreground font-bold"
          href={`/admin/vendors/${listing.vendor_id}`}
        >
          {listing.vendors?.business_name}
        </Link>{" "}
        · {listing.cities?.name} · {listing.categories?.name}
      </p>

      <div className="mt-6 space-y-3">
        {!vendorApproved && (
          <FormAlert>
            This vendor is <strong>{listing.vendors?.status}</strong>. A listing
            cannot be published until the business is approved.
          </FormAlert>
        )}
        {media.length === 0 && (
          <FormAlert>
            This listing has no portfolio images. Publication requires at least
            one.
          </FormAlert>
        )}
        {openReports.length > 0 && (
          <FormAlert>
            {openReports.length} open{" "}
            {openReports.length === 1 ? "report" : "reports"} against this
            listing. Review them before publishing.
          </FormAlert>
        )}
      </div>

      {/* The moderation queue previously showed a title and a summary only,
          so nobody could see the photographs they were approving. */}
      <section aria-labelledby="media-heading" className="mt-10">
        <h2 className="type-heading" id="media-heading">
          Portfolio ({media.length})
        </h2>
        {media.length === 0 ? (
          <p className="border-border text-muted-foreground mt-4 flex items-center gap-3 rounded-3xl border border-dashed p-8 text-sm">
            <ImageOff aria-hidden="true" size={18} /> No images uploaded.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <li
                className="border-border overflow-hidden rounded-2xl border"
                key={item.id}
              >
                <div className="bg-muted relative aspect-[4/3]">
                  <Image
                    alt={item.alt_text}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 22vw, 45vw"
                    src={publicUrl(item.storage_path)}
                  />
                </div>
                <p className="text-muted-foreground p-2 text-xs leading-4">
                  {item.alt_text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="content-heading" className="mt-10">
        <h2 className="type-heading" id="content-heading">
          Listing content
        </h2>
        <dl className="border-border mt-4 grid gap-4 rounded-3xl border bg-white p-6 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Starting price
            </dt>
            <dd className="mt-1 font-bold">
              {price.amount} {price.unit ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Locality
            </dt>
            <dd className="mt-1 font-bold">{listing.locality ?? "—"}</dd>
          </div>
          {/* A moderator approving a business needs the address it claims.
              This is the only surface that shows it: it is not a readable
              column, and this page reads it through a definer function scoped
              to admins and vendor members. */}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Address on file
            </dt>
            <dd className="mt-1 font-bold">
              {location?.street_address ?? "Not provided"}
            </dd>
            <dd className="text-muted-foreground mt-1 text-sm">
              {location?.latitude != null && location?.longitude != null ? (
                <>
                  Pinned at {location.latitude.toFixed(5)},{" "}
                  {location.longitude.toFixed(5)} ·{" "}
                  <a
                    className="link-underline text-brand-text font-bold"
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    open in Maps
                  </a>
                </>
              ) : (
                "No pin set — this listing is matched by its city only."
              )}
              {location?.service_radius_m
                ? ` · travels up to ${Math.round(location.service_radius_m / 1000)} km`
                : " · fixed location"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Years active
            </dt>
            <dd className="mt-1 font-bold">
              {listing.years_experience ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Public URL
            </dt>
            <dd className="mt-1 font-mono text-sm break-all">
              /vendor/{listing.slug}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Summary
            </dt>
            <dd className="mt-1 leading-7">{listing.summary}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Description
            </dt>
            <dd className="mt-1 leading-7 whitespace-pre-wrap">
              {listing.description}
            </dd>
          </div>
        </dl>
      </section>

      {reports.length > 0 && (
        <section aria-labelledby="reports-heading" className="mt-10">
          <div className="flex items-center gap-3">
            <AlertTriangle aria-hidden="true" className="text-brand-text" />
            <h2 className="type-heading" id="reports-heading">
              Reports
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            {reports.map((report) => (
              <li
                className="border-border rounded-2xl border bg-white p-4 text-sm"
                key={report.id}
              >
                <p className="font-bold">
                  {report.reason.replaceAll("_", " ")}{" "}
                  <span className="text-muted-foreground font-medium">
                    · {report.status} · {formatIndiaDateTime(report.created_at)}
                  </span>
                </p>
                {report.detail && (
                  <p className="text-muted-foreground mt-2 leading-6">
                    {report.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 className="type-heading" id="history-heading">
          Moderation
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Created {formatIndiaDateTime(listing.created_at)}
          {listing.published_at
            ? ` · first published ${formatIndiaDateTime(listing.published_at)}`
            : ""}
          {listing.moderated_at
            ? ` · last decision ${formatIndiaDateTime(listing.moderated_at)}`
            : ""}
        </p>
        {listing.moderation_note && (
          <p className="bg-muted mt-3 rounded-2xl p-4 text-sm leading-6">
            <strong>Last note:</strong> {listing.moderation_note}
          </p>
        )}

        <ModerationForm
          action={moderateListing}
          actions={ACTIONS[listing.status as keyof typeof ACTIONS] ?? []}
          entityId={listing.id}
          entityLabel={listing.title}
        />
      </section>
    </main>
  );
}
