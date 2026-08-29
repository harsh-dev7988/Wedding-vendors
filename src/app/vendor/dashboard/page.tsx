import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  CreditCard,
  Inbox,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { OnboardingProgress } from "@/components/vendor/onboarding-progress";
import { SubmitButton } from "@/components/ui/submit-button";

import { getCategories } from "@/data/categories";
import { getCities } from "@/data/cities";
import { requireViewer } from "@/lib/auth";
import { formatEventDate, formatIndiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { mediaUrlResolver } from "@/lib/supabase/media";

import {
  deleteListingImage,
  submitListingForReview,
  updateLeadStatus,
} from "./actions";
import { ImageUploadForm } from "./image-upload-form";
import { ListingForm } from "./listing-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Vendor workspace",
  robots: { index: false, follow: false },
};

type VendorRecord = { business_name: string; id: string; status: string };

type ListingRecord = {
  category_id: string;
  description: string;
  id: string;
  locality: string | null;
  price_from: number | null;
  price_unit: string;
  primary_city_id: string;
  slug: string;
  status: string;
  summary: string;
  title: string;
  vendor_id: string;
  years_experience: number | null;
};

type MediaRecord = {
  alt_text: string;
  id: string;
  listing_id: string;
  storage_path: string;
};

type LeadRecord = {
  created_at: string;
  event_date: string;
  guest_count: number | null;
  id: string;
  listing_id: string;
  message: string;
  status: string;
};

const NOTICES: Record<string, string> = {
  "application-created": "Vendor workspace created.",
  "image-deleted": "Portfolio image removed.",
  "image-uploaded": "Portfolio image uploaded.",
  "lead-updated": "Lead status updated.",
  "listing-created": "Draft listing created.",
  "listing-submitted": "Listing submitted for review.",
  "listing-updated": "Listing saved and returned to draft.",
};

const ERRORS: Record<string, string> = {
  "delete-failed": "That image could not be removed. Please try again.",
  forbidden: "Your role on this business does not allow that change.",
  "image-too-large": "Images must be a JPEG, PNG or WebP file under 5 MB.",
  "invalid-image":
    "That file is not a valid JPEG, PNG or WebP image. Check the file and add alt text of at least 5 characters.",
  "invalid-lead": "That lead could not be found.",
  "invalid-listing": "That listing could not be found.",
  "lead-update-failed":
    "The lead status could not be updated. It may belong to another business.",
  "needs-image":
    "Add at least one portfolio image before submitting for review.",
  "submit-failed":
    "That listing could not be submitted. Only draft or returned listings can be sent for review.",
  "upload-failed": "The upload did not complete. Please try again.",
};

const LISTING_STATUS_COPY: Record<string, string> = {
  archived: "Archived",
  draft: "Draft — not visible publicly",
  pending_review: "In moderation",
  published: "Published",
  rejected: "Returned for changes",
  suspended: "Suspended by a moderator",
};

const LEAD_STATUSES = [
  { label: "Viewed", value: "viewed" },
  { label: "Contacted", value: "contacted" },
  { label: "Qualified", value: "qualified" },
  { label: "Completed / closed", value: "closed" },
  { label: "Spam", value: "spam" },
] as const;

export default async function VendorDashboardPage({
  searchParams,
}: PageProps<"/vendor/dashboard">) {
  const viewer = await requireViewer("/vendor/dashboard");
  const params = await searchParams;
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendor_id, role")
    .eq("user_id", viewer.id);

  const vendorIds = (memberships ?? []).map((item) => item.vendor_id as string);

  if (vendorIds.length === 0) {
    return (
      <main
        className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center"
        id="main-content"
      >
        <Building2 aria-hidden="true" className="text-brand-text" size={36} />
        <h1 className="type-title mt-5">Create your vendor workspace</h1>
        <p className="text-muted-foreground mt-4 max-w-xl leading-7">
          Start with private business details, then add category-specific
          listings for moderation.
        </p>
        <Link
          className="bg-foreground hover:bg-brand-solid-hover mt-7 inline-flex min-h-12 items-center rounded-full px-6 font-bold text-white transition"
          href="/for-vendors/apply"
        >
          Start application
        </Link>
      </main>
    );
  }

  const [{ data: vendorRows }, { data: listingRows }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, business_name, status")
      .in("id", vendorIds),
    supabase
      .from("listings")
      .select(
        "id, vendor_id, category_id, primary_city_id, slug, title, summary, description, locality, price_from, price_unit, years_experience, status",
      )
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const vendors = (vendorRows ?? []) as VendorRecord[];
  const listings = (listingRows ?? []) as ListingRecord[];
  const listingIds = listings.map(({ id }) => id);

  const [{ data: mediaRows }, { data: leadRows }] = listingIds.length
    ? await Promise.all([
        supabase
          .from("listing_media")
          .select("id, listing_id, storage_path, alt_text")
          .in("listing_id", listingIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("leads")
          .select(
            "id, listing_id, event_date, guest_count, message, status, created_at",
          )
          .in("listing_id", listingIds)
          .order("created_at", { ascending: false })
          .limit(50),
      ])
    : [{ data: [] }, { data: [] }];

  const media = (mediaRows ?? []) as MediaRecord[];
  const leads = (leadRows ?? []) as LeadRecord[];

  // The edit form preselects by slug, but listings store taxonomy ids.
  const [{ data: categoryRows }, { data: cityRows }] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase.from("cities").select("id, slug"),
  ]);
  const categorySlugById = new Map(
    (categoryRows ?? []).map((row) => [row.id as string, row.slug as string]),
  );
  const citySlugById = new Map(
    (cityRows ?? []).map((row) => [row.id as string, row.slug as string]),
  );
  const notice = typeof params.notice === "string" ? params.notice : null;
  const errorFlag = typeof params.error === "string" ? params.error : null;

  const publicUrl = mediaUrlResolver(supabase, "thumb");

  // Every active category, venues included — a venue owner has to be able
  // to pick Venues. The public split between the two sections is about how
  // people browse, not about what a vendor may list.
  const categoryOptions = (await getCategories()).map((category) => ({
    allowedPriceUnits: category.allowedPriceUnits,
    name: category.name,
    slug: category.slug,
  }));
  const cityOptions = (await getCities()).map((metro) => ({
    name: metro.name,
    slug: metro.slug,
  }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-8" id="main-content">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-brand-text eyebrow">Vendor workspace</p>
          <h1 className="type-display mt-2">Manage listings and leads</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition"
            href="/vendor/dashboard/settings"
          >
            <Settings aria-hidden="true" size={16} /> Business settings
          </Link>
          <Link
            className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition"
            href="/vendor/dashboard/billing"
          >
            <CreditCard aria-hidden="true" size={16} /> Billing
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm font-bold transition"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-7 space-y-3">
        {notice && NOTICES[notice] && (
          <StatusBanner>{NOTICES[notice]}</StatusBanner>
        )}
        {errorFlag && (
          <FormAlert>
            {ERRORS[errorFlag] ??
              "That operation could not be completed. Please try again."}
          </FormAlert>
        )}
      </div>

      {/* Only the first business needs walking through; after that the vendor
          knows how this works. */}
      {vendors.length > 0 && (
        <OnboardingProgress
          state={{
            hasListing: listings.length > 0,
            hasPublishedListing: listings.some(
              (listing) => listing.status === "published",
            ),
            hasSubmittedListing: listings.some((listing) =>
              ["pending_review", "published"].includes(listing.status),
            ),
            vendorStatus: vendors[0].status,
          }}
        />
      )}

      <section aria-labelledby="businesses-heading" className="mt-10">
        <h2 className="sr-only" id="businesses-heading">
          Your businesses
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {vendors.map((vendor) => (
            <article
              className="border-border shadow-soft rounded-3xl border bg-white p-6"
              key={vendor.id}
            >
              <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                {vendor.status.replaceAll("_", " ")}
              </p>
              <h3 className="type-heading mt-3">{vendor.business_name}</h3>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {vendor.status === "approved"
                  ? "Approved. Published listings are visible in the marketplace."
                  : vendor.status === "suspended"
                    ? "Suspended by a moderator. Published listings have been taken down."
                    : "Awaiting moderation. Listings stay private until the business is approved."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="create-listing-heading"
        className="mt-14 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div>
          <div className="flex items-center gap-3">
            <Plus aria-hidden="true" className="text-brand-text" />
            <h2 className="type-title" id="create-listing-heading">
              Create a listing
            </h2>
          </div>
          <div className="mt-6">
            <ListingForm
              categories={categoryOptions}
              cities={cityOptions}
              mode="create"
              vendors={vendors}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <ClipboardList aria-hidden="true" className="text-brand-text" />
            <h2 className="type-title">Listings</h2>
          </div>

          <div className="mt-6 space-y-4">
            {listings.length === 0 && (
              <p className="border-border text-muted-foreground rounded-3xl border border-dashed p-8">
                No listings yet. Create your first listing on the left.
              </p>
            )}

            {listings.map((listing) => {
              const listingMedia = media.filter(
                (item) => item.listing_id === listing.id,
              );
              const canSubmit =
                listing.status === "draft" || listing.status === "rejected";

              return (
                <article
                  className="border-border grid gap-4 rounded-2xl border bg-white p-5"
                  key={listing.id}
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold">{listing.title}</h3>
                      <p className="text-muted-foreground mt-1 text-xs font-bold tracking-wider uppercase">
                        {LISTING_STATUS_COPY[listing.status] ?? listing.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {listing.status === "published" && (
                        <Link
                          className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition"
                          href={`/vendor/${listing.slug}`}
                        >
                          View public page
                        </Link>
                      )}
                      {canSubmit && (
                        <form action={submitListingForReview}>
                          <input
                            name="listingId"
                            type="hidden"
                            value={listing.id}
                          />
                          <SubmitButton
                            className="bg-brand-solid hover:bg-brand-solid-hover min-h-11 rounded-full px-4 text-sm text-white"
                            pendingLabel="Submitting…"
                          >
                            Submit for review
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <details className="border-border border-t pt-4">
                    <summary className="min-h-11 cursor-pointer text-sm font-bold">
                      Edit listing details
                    </summary>
                    <div className="mt-4">
                      <ListingForm
                        categories={categoryOptions}
                        cities={cityOptions}
                        defaults={{
                          categorySlug: categorySlugById.get(
                            listing.category_id,
                          ),
                          citySlug: citySlugById.get(listing.primary_city_id),
                          description: listing.description,
                          id: listing.id,
                          locality: listing.locality ?? "",
                          priceFrom:
                            listing.price_from === null
                              ? ""
                              : String(listing.price_from),
                          priceUnit: listing.price_unit,
                          summary: listing.summary,
                          title: listing.title,
                          vendorId: listing.vendor_id,
                          yearsExperience:
                            listing.years_experience === null
                              ? ""
                              : String(listing.years_experience),
                        }}
                        mode="edit"
                        vendors={vendors}
                      />
                    </div>
                  </details>

                  <div className="border-border border-t pt-4">
                    <h4 className="text-sm font-bold">
                      Portfolio ({listingMedia.length})
                    </h4>
                    {listingMedia.length > 0 && (
                      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {listingMedia.map((item) => (
                          <li
                            className="border-border relative overflow-hidden rounded-xl border"
                            key={item.id}
                          >
                            <div className="bg-muted relative aspect-square">
                              <Image
                                alt={item.alt_text}
                                className="object-cover"
                                fill
                                sizes="120px"
                                src={publicUrl(item.storage_path)}
                              />
                            </div>
                            <form action={deleteListingImage}>
                              <input
                                name="mediaId"
                                type="hidden"
                                value={item.id}
                              />
                              <SubmitButton
                                className="text-brand-text w-full bg-white/95 py-1.5 text-xs"
                                pendingLabel="Removing…"
                              >
                                <Trash2 aria-hidden="true" size={13} />
                                <span className="sr-only">
                                  Remove image: {item.alt_text}
                                </span>
                                Remove
                              </SubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    <ImageUploadForm listingId={listing.id} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-12 flex items-center gap-3">
            <Inbox aria-hidden="true" className="text-brand-text" />
            <h2 className="type-title">Lead inbox</h2>
          </div>

          <div className="mt-6 space-y-4">
            {leads.length === 0 && (
              <p className="border-border text-muted-foreground rounded-3xl border border-dashed p-8">
                Validated customer enquiries will appear here.
              </p>
            )}

            {leads.map((lead) => {
              const listing = listings.find(({ id }) => id === lead.listing_id);
              return (
                <article
                  className="border-border shadow-soft rounded-3xl border bg-white p-6"
                  key={lead.id}
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">
                        {listing?.title ?? "Listing enquiry"}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Event {formatEventDate(lead.event_date)}
                        {lead.guest_count
                          ? ` · ${lead.guest_count} guests`
                          : ""}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Received {formatIndiaDateTime(lead.created_at)}
                      </p>
                    </div>
                    <div className="flex h-fit items-center gap-2">
                      <span className="bg-muted rounded-full px-3 py-1 text-xs font-bold uppercase">
                        {lead.status}
                      </span>
                      <Link
                        className="bg-foreground hover:bg-brand-solid-hover inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white transition"
                        href={`/vendor/dashboard/leads/${lead.id}`}
                      >
                        Open
                      </Link>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-4 text-sm leading-6 whitespace-pre-wrap">
                    {lead.message}
                  </p>

                  <form
                    action={updateLeadStatus}
                    className="mt-5 flex flex-wrap items-end gap-2"
                  >
                    <input name="leadId" type="hidden" value={lead.id} />
                    <label
                      className="grid flex-1 gap-1 text-xs font-bold"
                      htmlFor={`lead-status-${lead.id}`}
                    >
                      Lead status
                      <select
                        className="border-border select-field min-h-11 rounded-xl border px-3 text-sm font-medium"
                        defaultValue={
                          lead.status === "new" ? "viewed" : lead.status
                        }
                        id={`lead-status-${lead.id}`}
                        name="status"
                      >
                        {LEAD_STATUSES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton
                      className="bg-foreground hover:bg-brand-solid-hover min-h-11 rounded-xl px-4 text-sm text-white"
                      pendingLabel="Updating…"
                    >
                      Update
                    </SubmitButton>
                  </form>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Marking an enquiry complete lets the customer leave a
                    review. Customers can also review 14 days after the event
                    date.
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
