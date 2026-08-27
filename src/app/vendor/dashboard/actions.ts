"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  describeDatabaseError,
  fieldErrorsFromZod,
  formValues,
  invalid,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import {
  MAX_SERVICE_RADIUS_M,
  MIN_SERVICE_RADIUS_M,
  defaultServiceRadiusM,
  isPlausibleIndianCoordinate,
} from "@/lib/geo";
import {
  MAX_IMAGE_BYTES,
  STORED_IMAGE_EXTENSION,
  allVariantPaths,
  sniffImageType,
  variantPath,
} from "@/lib/image";
import { processUpload } from "@/lib/image-pipeline";
import { createSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Roles allowed to author listing content. */
const CONTENT_ROLES = ["owner", "manager", "editor"];

/**
 * The database enforces roles through `has_vendor_role` in every policy; this
 * mirrors the check in the application so the user gets a clear message instead
 * of an opaque RLS rejection.
 */
async function assertVendorRole(
  supabase: Supabase,
  vendorId: string,
  userId: string,
  roles: readonly string[],
) {
  const { data } = await supabase
    .from("vendor_members")
    .select("role")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data && roles.includes(data.role as string));
}

const listingSchema = z.object({
  categorySlug: z.string().min(1),
  citySlug: z.string().min(1),
  description: z
    .string()
    .trim()
    .min(50, "Describe the service in at least 50 characters.")
    .max(10000, "Keep the description under 10,000 characters."),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  locality: z.string().trim().max(120).optional().default(""),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  priceFrom: z.coerce.number().int().min(0).max(100000000).optional(),
  priceUnit: z.enum([
    "per_plate",
    "per_event",
    "per_function",
    "per_day",
    "package",
    "on_request",
  ]),
  summary: z
    .string()
    .trim()
    .min(20, "Write a summary of at least 20 characters.")
    .max(320, "Keep the summary under 320 characters."),
  title: z.string().trim().min(2, "Enter a listing title.").max(160),
  vendorId: z.uuid(),
  serviceRadiusKm: z.coerce
    .number()
    .int()
    .min(MIN_SERVICE_RADIUS_M / 1000)
    .max(MAX_SERVICE_RADIUS_M / 1000)
    .optional(),
  streetAddress: z.string().trim().max(500).optional().default(""),
  yearsExperience: z.coerce.number().int().min(0).max(100).optional(),
});

const LISTING_FIELDS = [
  "categorySlug",
  "citySlug",
  "description",
  "latitude",
  "locality",
  "longitude",
  "serviceRadiusKm",
  "streetAddress",
  "priceFrom",
  "priceUnit",
  "summary",
  "title",
  "vendorId",
  "yearsExperience",
] as const;

function parseListing(formData: FormData) {
  return listingSchema.safeParse({
    categorySlug: formData.get("categorySlug"),
    citySlug: formData.get("citySlug"),
    description: formData.get("description"),
    latitude: formData.get("latitude") || undefined,
    locality: formData.get("locality") ?? "",
    longitude: formData.get("longitude") || undefined,
    priceFrom: formData.get("priceFrom") || undefined,
    priceUnit: formData.get("priceUnit"),
    summary: formData.get("summary"),
    title: formData.get("title"),
    vendorId: formData.get("vendorId"),
    serviceRadiusKm: formData.get("serviceRadiusKm") || undefined,
    streetAddress: formData.get("streetAddress") ?? "",
    yearsExperience: formData.get("yearsExperience") || undefined,
  });
}

type GeoInput = Pick<
  z.infer<typeof listingSchema>,
  | "categorySlug"
  | "latitude"
  | "longitude"
  | "serviceRadiusKm"
  | "streetAddress"
>;

/**
 * Turns the picked coordinates into the columns the database expects.
 *
 * `geo` is written as WKT rather than through PostGIS helpers because
 * PostgREST cannot call a function in an insert payload. A trigger keeps
 * `latitude`/`longitude` in step with it.
 *
 * Returns `null` when the submitted point is not plausible, so the caller can
 * reject rather than store nonsense. On a create with no point at all the geo
 * columns are simply null — a vendor can save a draft before deciding where
 * they are.
 */
function geoColumns(input: GeoInput, mode: "create" | "update") {
  const hasPoint =
    typeof input.latitude === "number" && typeof input.longitude === "number";

  if (
    hasPoint &&
    !isPlausibleIndianCoordinate(input.latitude!, input.longitude!)
  ) {
    return null;
  }

  // A venue is a fixed place, so it has no service radius at all. Anything
  // mobile falls back to the 30 km default rather than being unbounded.
  const fallback = defaultServiceRadiusM(input.categorySlug);
  const radius =
    fallback === null
      ? null
      : (input.serviceRadiusKm ?? fallback / 1000) * 1000;

  // On an edit with no point submitted, leave the stored location alone. The
  // alternative is that saving a title change wipes the pin, which is silent
  // data loss — and there is no UI for clearing a location deliberately.
  if (!hasPoint && mode === "update") {
    return { service_radius_m: radius };
  }

  return {
    geo: hasPoint
      ? `SRID=4326;POINT(${input.longitude} ${input.latitude})`
      : null,
    service_radius_m: radius,
    street_address: input.streetAddress || null,
  };
}

/**
 * The vendor declares a city and separately picks a point. When those disagree
 * we trust the geometry and say so, rather than silently filing a Pune venue
 * under Mumbai — but we do not block, because border cases are real.
 */
async function cityMismatchWarning(
  supabase: Supabase,
  declaredSlug: string,
  latitude?: number,
  longitude?: number,
) {
  if (typeof latitude !== "number" || typeof longitude !== "number")
    return null;

  const { data } = await supabase.rpc("get_nearest_city", {
    origin_lat: latitude,
    origin_lng: longitude,
  });
  const nearest = Array.isArray(data) ? data[0] : null;
  if (!nearest || nearest.slug === declaredSlug) return null;

  return `That address looks closest to ${nearest.name}, but you chose a different city. Customers searching ${nearest.name} may not find you.`;
}

export async function createListing(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/vendor/dashboard");
  const values = formValues(formData, LISTING_FIELDS);
  const parsed = parseListing(formData);

  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const [{ data: category }, { data: city }, allowed] = await Promise.all([
    supabase
      .from("categories")
      .select("id")
      .eq("slug", parsed.data.categorySlug)
      .maybeSingle(),
    supabase
      .from("cities")
      .select("id")
      .eq("slug", parsed.data.citySlug)
      .maybeSingle(),
    assertVendorRole(supabase, parsed.data.vendorId, viewer.id, CONTENT_ROLES),
  ]);

  if (!category || !city) {
    return invalid("That city or category is no longer available.", { values });
  }
  if (!allowed) {
    return invalid(
      "Your role on this business does not allow creating listings.",
      { values },
    );
  }

  const geo = geoColumns(parsed.data, "create");
  if (!geo) {
    return invalid(
      "That location is outside India. Search for your address again.",
      { values },
    );
  }

  const slugBase = createSlug(parsed.data.title) || "listing";

  // `listings.slug` is unique. Retry with a fresh suffix rather than surfacing
  // a constraint violation to the vendor.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug =
      attempt === 0 ? slugBase : `${slugBase}-${randomUUID().slice(0, 6)}`;

    const { data, error } = await supabase
      .from("listings")
      .insert({
        ...geo,
        category_id: category.id,
        description: parsed.data.description,
        locality: parsed.data.locality || null,
        price_from: parsed.data.priceFrom ?? null,
        price_unit: parsed.data.priceUnit,
        primary_city_id: city.id,
        slug,
        status: "draft",
        summary: parsed.data.summary,
        title: parsed.data.title,
        vendor_id: parsed.data.vendorId,
        years_experience: parsed.data.yearsExperience ?? null,
      })
      .select("id");

    if (!error && data?.length) {
      const mismatch = await cityMismatchWarning(
        supabase,
        parsed.data.citySlug,
        parsed.data.latitude,
        parsed.data.longitude,
      );
      revalidatePath("/vendor/dashboard");
      redirect(
        mismatch
          ? `/vendor/dashboard/listings?notice=listing-created&warn=${encodeURIComponent(mismatch)}`
          : "/vendor/dashboard/listings?notice=listing-created",
      );
    }
    if (error?.code !== "23505") {
      return invalid(
        describeDatabaseError(
          error,
          "The listing could not be saved. Please try again.",
        ),
        { values },
      );
    }
  }

  return invalid(
    "A listing with a similar name already exists. Try a more specific title.",
    { values },
  );
}

export async function updateListing(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/vendor/dashboard");
  const values = formValues(formData, LISTING_FIELDS);
  const listingId = z.uuid().safeParse(formData.get("listingId"));
  const parsed = parseListing(formData);

  if (!listingId.success) return invalid("That listing could not be found.");
  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const supabase = await createClient();
  const allowed = await assertVendorRole(
    supabase,
    parsed.data.vendorId,
    viewer.id,
    CONTENT_ROLES,
  );
  if (!allowed) {
    return invalid(
      "Your role on this business does not allow editing listings.",
      {
        values,
      },
    );
  }

  const [{ data: category }, { data: city }] = await Promise.all([
    supabase
      .from("categories")
      .select("id")
      .eq("slug", parsed.data.categorySlug)
      .maybeSingle(),
    supabase
      .from("cities")
      .select("id")
      .eq("slug", parsed.data.citySlug)
      .maybeSingle(),
  ]);

  if (!category || !city) {
    return invalid("That city or category is no longer available.", { values });
  }

  const geo = geoColumns(parsed.data, "update");
  if (!geo) {
    return invalid(
      "That location is outside India. Search for your address again.",
      { values },
    );
  }

  // Editing returns a listing to draft so a published page can never change
  // without passing moderation again.
  const { data, error } = await supabase
    .from("listings")
    .update({
      ...geo,
      category_id: category.id,
      description: parsed.data.description,
      locality: parsed.data.locality || null,
      price_from: parsed.data.priceFrom ?? null,
      price_unit: parsed.data.priceUnit,
      primary_city_id: city.id,
      status: "draft",
      summary: parsed.data.summary,
      title: parsed.data.title,
      years_experience: parsed.data.yearsExperience ?? null,
    })
    .eq("id", listingId.data)
    .select("id");

  if (error || !data?.length) {
    return invalid(
      describeDatabaseError(
        error,
        "That listing could not be updated. A suspended listing can only be changed by a moderator.",
      ),
      { values },
    );
  }

  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendor/[slug]", "page");
  redirect("/vendor/dashboard?notice=listing-updated");
}

export async function submitListingForReview(formData: FormData) {
  await requireViewer("/vendor/dashboard");
  const listingId = z.uuid().safeParse(formData.get("listingId"));
  if (!listingId.success) redirect("/vendor/dashboard?error=invalid-listing");

  const supabase = await createClient();
  // A listing must have at least one image before a moderator can publish it,
  // so it is pointless to queue one without media.
  const { count } = await supabase
    .from("listing_media")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId.data);

  if (!count) redirect("/vendor/dashboard?error=needs-image");

  const { data, error } = await supabase
    .from("listings")
    .update({ status: "pending_review" })
    .eq("id", listingId.data)
    .in("status", ["draft", "rejected"])
    .select("id");

  // PostgREST reports no error when an UPDATE matches nothing, so the row count
  // is the only reliable success signal — otherwise a no-op reported success.
  if (error || !data?.length) {
    redirect("/vendor/dashboard?error=submit-failed");
  }

  revalidatePath("/vendor/dashboard");
  redirect("/vendor/dashboard?notice=listing-submitted");
}

const leadUpdateSchema = z.object({
  leadId: z.uuid(),
  status: z.enum(["viewed", "contacted", "qualified", "closed", "spam"]),
});

export async function updateLeadStatus(formData: FormData) {
  await requireViewer("/vendor/dashboard");
  const parsed = leadUpdateSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/vendor/dashboard?error=invalid-lead");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.leadId)
    .select("id");

  if (error || !data?.length) {
    redirect("/vendor/dashboard?error=lead-update-failed");
  }

  revalidatePath("/vendor/dashboard");
  redirect("/vendor/dashboard?notice=lead-updated");
}

export async function uploadListingImage(formData: FormData) {
  const viewer = await requireViewer("/vendor/dashboard");
  const listingId = z.uuid().safeParse(formData.get("listingId"));
  const altText = z
    .string()
    .trim()
    .min(5)
    .max(240)
    .safeParse(formData.get("altText"));
  const file = formData.get("image");

  if (!listingId.success || !altText.success || !(file instanceof File)) {
    redirect("/vendor/dashboard?error=invalid-image");
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    redirect("/vendor/dashboard?error=image-too-large");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed) redirect("/vendor/dashboard?error=invalid-image");

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, vendor_id")
    .eq("id", listingId.data)
    .maybeSingle();

  if (!listing) redirect("/vendor/dashboard?error=invalid-image");

  const allowed = await assertVendorRole(
    supabase,
    listing.vendor_id as string,
    viewer.id,
    CONTENT_ROLES,
  );
  if (!allowed) redirect("/vendor/dashboard?error=forbidden");

  // Re-encoded before it is stored, which is what removes the EXIF GPS tags a
  // phone camera writes. The bucket is public, so the uploaded bytes must
  // never reach it unmodified. See lib/image-pipeline.ts.
  const processed = await processUpload(bytes);
  if (!processed) redirect("/vendor/dashboard?error=invalid-image");

  // Keyed on the vendor, not the uploader: the bucket policy checks vendor
  // membership, so it is no longer an open upload target for any signed-in
  // user, and a teammate can manage the file later.
  const storagePath = `${listing.vendor_id}/${listing.id}/${randomUUID()}.${STORED_IMAGE_EXTENSION}`;

  const written: string[] = [];
  for (const rendition of processed.variants) {
    const path = variantPath(storagePath, rendition.variant);
    const { error: uploadError } = await supabase.storage
      .from("vendor-media")
      .upload(path, rendition.bytes, {
        cacheControl: "31536000",
        contentType: processed.contentType,
        upsert: false,
      });

    if (uploadError) {
      // Partial writes would leave a card-sized object with no full-size
      // sibling, so unwind before bailing out.
      if (written.length > 0) {
        await supabase.storage.from("vendor-media").remove(written);
      }
      redirect("/vendor/dashboard?error=upload-failed");
    }
    written.push(path);
  }

  const { count } = await supabase
    .from("listing_media")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing.id);

  const { error: mediaError } = await supabase.from("listing_media").insert({
    alt_text: altText.data,
    listing_id: listing.id,
    sort_order: count ?? 0,
    storage_path: storagePath,
  });

  if (mediaError) {
    // Compensate so a failed row never leaves an orphaned object behind.
    await supabase.storage.from("vendor-media").remove(written);
    redirect("/vendor/dashboard?error=upload-failed");
  }

  revalidatePath("/vendor/dashboard");
  redirect("/vendor/dashboard?notice=image-uploaded");
}

export async function deleteListingImage(formData: FormData) {
  const viewer = await requireViewer("/vendor/dashboard");
  const mediaId = z.uuid().safeParse(formData.get("mediaId"));
  if (!mediaId.success) redirect("/vendor/dashboard?error=invalid-image");

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("listing_media")
    .select("id, storage_path, listing_id, listings(vendor_id)")
    .eq("id", mediaId.data)
    .maybeSingle();

  if (!media) redirect("/vendor/dashboard?error=invalid-image");

  const vendorId = (media as unknown as { listings: { vendor_id: string } })
    .listings?.vendor_id;
  const allowed =
    vendorId &&
    (await assertVendorRole(supabase, vendorId, viewer.id, CONTENT_ROLES));
  if (!allowed) redirect("/vendor/dashboard?error=forbidden");

  const { data, error } = await supabase
    .from("listing_media")
    .delete()
    .eq("id", mediaId.data)
    .select("id");

  if (error || !data?.length) {
    redirect("/vendor/dashboard?error=delete-failed");
  }

  // Removing the row first means a storage failure leaves an unreferenced
  // object rather than a listing pointing at a deleted file.
  await supabase.storage
    .from("vendor-media")
    .remove(allVariantPaths(media.storage_path as string));

  revalidatePath("/vendor/dashboard");
  redirect("/vendor/dashboard?notice=image-deleted");
}
