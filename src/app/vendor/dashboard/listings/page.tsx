import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { launchCategories } from "@/config/categories";
import { metros } from "@/data/seed/marketplace";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaUrlResolver } from "@/lib/supabase/media";

import { deleteListingImage, submitListingForReview } from "../actions";
import { ImageUploadForm } from "../image-upload-form";
import { ListingForm } from "../listing-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};

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

const STATUS_COPY: Record<string, string> = {
  archived: "Archived",
  draft: "Draft — not visible publicly",
  pending_review: "In moderation",
  published: "Published",
  rejected: "Returned for changes",
  suspended: "Suspended by a moderator",
};

const NOTICES: Record<string, string> = {
  "image-deleted": "Portfolio image removed.",
  "image-uploaded": "Portfolio image uploaded.",
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
  "invalid-listing": "That listing could not be found.",
  "needs-image":
    "Add at least one portfolio image before submitting for review.",
  "submit-failed": "Only draft or returned listings can be sent for review.",
  "upload-failed": "The upload did not complete. Please try again.",
};

export default async function VendorListingsPage({
  searchParams,
}: PageProps<"/vendor/dashboard/listings">) {
  const viewer = await requireViewer("/vendor/dashboard/listings");
  const params = await searchParams;
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendor_id")
    .eq("user_id", viewer.id);

  const vendorIds = (memberships ?? []).map((row) => row.vendor_id as string);

  if (vendorIds.length === 0) {
    return (
      <main
        className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8"
        id="main-content"
      >
        <h1 className="type-title">No business yet</h1>
        <p className="text-muted-foreground mt-4 leading-7">
          Create a vendor workspace before adding listings.
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

  const [
    { data: vendorRows },
    { data: listingRows },
    { data: categoryRows },
    { data: cityRows },
  ] = await Promise.all([
    supabase.from("vendors").select("id, business_name").in("id", vendorIds),
    supabase
      .from("listings")
      .select(
        "id, vendor_id, category_id, primary_city_id, slug, title, summary, description, locality, price_from, price_unit, years_experience, status",
      )
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("categories").select("id, slug"),
    supabase.from("cities").select("id, slug"),
  ]);

  const vendors = (vendorRows ?? []) as Array<{
    business_name: string;
    id: string;
  }>;
  const listings = (listingRows ?? []) as ListingRecord[];
  const categorySlugById = new Map(
    (categoryRows ?? []).map((r) => [r.id as string, r.slug as string]),
  );
  const citySlugById = new Map(
    (cityRows ?? []).map((r) => [r.id as string, r.slug as string]),
  );

  const { data: mediaRows } = listings.length
    ? await supabase
        .from("listing_media")
        .select("id, listing_id, storage_path, alt_text")
        .in(
          "listing_id",
          listings.map((l) => l.id),
        )
        .order("sort_order", { ascending: true })
    : { data: [] };

  const media = (mediaRows ?? []) as Array<{
    alt_text: string;
    id: string;
    listing_id: string;
    storage_path: string;
  }>;

  const publicUrl = mediaUrlResolver(supabase, "thumb");

  const notice = typeof params.notice === "string" ? params.notice : null;
  const errorFlag = typeof params.error === "string" ? params.error : null;

  const categoryOptions = launchCategories.map((c) => ({
    name: c.name,
    slug: c.slug,
  }));
  const cityOptions = metros.map((m) => ({ name: m.name, slug: m.slug }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-8" id="main-content">
      <div className="flex items-center gap-3">
        <ClipboardList aria-hidden="true" className="text-brand-text" />
        <h1 className="type-title">Listings</h1>
      </div>

      <div className="mt-6 space-y-3">
        {notice && NOTICES[notice] && (
          <StatusBanner>{NOTICES[notice]}</StatusBanner>
        )}
        {errorFlag && (
          <FormAlert>
            {ERRORS[errorFlag] ?? "That operation could not be completed."}
          </FormAlert>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section aria-labelledby="create-heading">
          <div className="flex items-center gap-3">
            <Plus aria-hidden="true" className="text-brand-text" />
            <h2 className="type-heading" id="create-heading">
              Create a listing
            </h2>
          </div>
          <div className="mt-5">
            <ListingForm
              categories={categoryOptions}
              cities={cityOptions}
              mode="create"
              vendors={vendors}
            />
          </div>
        </section>

        <section aria-labelledby="existing-heading">
          <h2 className="type-heading" id="existing-heading">
            Your listings ({listings.length})
          </h2>

          <div className="mt-5 space-y-4">
            {listings.length === 0 && (
              <p className="border-border text-muted-foreground rounded-3xl border border-dashed p-8 text-sm">
                No listings yet. Create your first on the left.
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
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold">{listing.title}</h3>
                      <p className="text-muted-foreground mt-1 text-xs font-bold tracking-wider uppercase">
                        {STATUS_COPY[listing.status] ?? listing.status}
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
        </section>
      </div>
    </main>
  );
}
