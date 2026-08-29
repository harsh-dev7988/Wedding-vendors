import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  Info,
  LockKeyhole,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { VendorCard } from "@/components/marketplace/vendor-card";
import { ShortlistButton } from "@/components/marketplace/shortlist-button";
import { RatingBadge, RatingStars } from "@/components/ui/rating";
import { siteConfig } from "@/config/site";
import {
  getLiveVendorBySlug,
  getPublishedReviews,
  getRelatedLiveVendors,
  resolveRenamedSlug,
} from "@/data/live-marketplace";
import { getCategoryBySlug } from "@/data/categories";
import {
  getPreviewVendorSlugs,
  getRelatedPreviewVendors,
  getVendorBySlug,
} from "@/data/marketplace";
import { isPreviewVendor, type PublicVendor } from "@/domain/marketplace";
import { getCityBySlug } from "@/data/cities";
import { formatServiceRadius } from "@/lib/geo";
import { formatEventDate } from "@/lib/datetime";
import { breadcrumbJsonLd, vendorJsonLd } from "@/lib/seo/structured-data";

import { ReportListingForm } from "./report-form";
import {
  formatReviewCount,
  formatStartingPrice,
  formatYearsInBusiness,
} from "@/lib/format";

export const revalidate = 300;

export function generateStaticParams() {
  // Only the preview fixtures are known at build time; live slugs render on
  // demand and are then cached for `revalidate` seconds.
  return getPreviewVendorSlugs();
}

async function loadVendor(slug: string): Promise<PublicVendor | null> {
  return (await getLiveVendorBySlug(slug)) ?? getVendorBySlug(slug) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/vendor/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await loadVendor(slug);
  if (!vendor) return {};

  const canonical = `/vendor/${vendor.slug}`;

  return {
    title: vendor.name,
    description: vendor.summary,
    alternates: { canonical },
    // A fictional fixture must never be submitted for indexing as a business.
    robots: isPreviewVendor(vendor)
      ? { index: false, follow: false }
      : undefined,
    openGraph: {
      title: vendor.name,
      description: vendor.summary,
      url: canonical,
      images: vendor.image.startsWith("http")
        ? [{ url: vendor.image, alt: vendor.imageAlt }]
        : [{ url: `${siteConfig.url}${vendor.image}`, alt: vendor.imageAlt }],
    },
  };
}

export default async function VendorProfilePage({
  params,
}: PageProps<"/vendor/[slug]">) {
  const { slug } = await params;
  const vendor = await loadVendor(slug);

  if (!vendor) {
    const currentSlug = await resolveRenamedSlug(slug);
    if (currentSlug) permanentRedirect(`/vendor/${currentSlug}`);
    notFound();
  }

  const preview = isPreviewVendor(vendor);
  const metro = await getCityBySlug(vendor.citySlug);
  const category = await getCategoryBySlug(vendor.categorySlug);
  const price = formatStartingPrice(vendor.startingPrice, vendor.priceUnit);

  const [related, reviews] = await Promise.all([
    preview
      ? Promise.resolve(getRelatedPreviewVendors(vendor.slug))
      : getRelatedLiveVendors(vendor),
    preview || !vendor.listingId
      ? Promise.resolve([])
      : getPublishedReviews(vendor.listingId),
  ]);

  const travels = formatServiceRadius(vendor.serviceRadiusM);
  const gallery = vendor.media.length
    ? vendor.media
    : [{ url: vendor.image, alt: vendor.imageAlt }];
  const [cover, ...rest] = gallery;

  // Preview fixtures return null from both builders, so a fictional business
  // is never marked up for search engines.
  const structuredData = vendorJsonLd(vendor, {
    categoryName: category?.name,
    cityName: metro?.name,
  });
  const breadcrumbs = preview
    ? null
    : breadcrumbJsonLd([
        { name: "Vendors", path: "/vendors" },
        ...(metro
          ? [{ name: metro.name, path: `/vendors/${metro.slug}` }]
          : []),
        ...(metro && category
          ? [
              {
                name: category.name,
                path: `/vendors/${metro.slug}/${category.slug}`,
              },
            ]
          : []),
        { name: vendor.name, path: `/vendor/${vendor.slug}` },
      ]);

  return (
    <main id="main-content">
      <JsonLd data={structuredData} />
      <JsonLd data={breadcrumbs} />
      <div className="text-muted-foreground mx-auto max-w-7xl px-5 py-5 text-sm md:px-8">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5"
        >
          <Link className="hover:text-foreground" href="/vendors">
            Vendors
          </Link>
          <ChevronRight aria-hidden="true" size={14} />
          {metro && (
            <>
              <Link
                className="hover:text-foreground"
                href={`/vendors/${metro.slug}`}
              >
                {metro.name}
              </Link>
              <ChevronRight aria-hidden="true" size={14} />
            </>
          )}
          {metro && category && (
            <>
              <Link
                className="hover:text-foreground"
                href={`/vendors/${metro.slug}/${category.slug}`}
              >
                {category.name}
              </Link>
              <ChevronRight aria-hidden="true" size={14} />
            </>
          )}
          <span className="text-foreground" aria-current="page">
            {vendor.name}
          </span>
        </nav>
      </div>

      {/* Preview disclosure sits above the fold, not below the fold under a
          stats block — and only ever renders for an actual preview fixture. */}
      {preview && (
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <aside
            aria-labelledby="preview-notice-heading"
            className="border-brand-text/25 bg-brand-soft flex items-start gap-4 rounded-2xl border p-5"
          >
            <Info
              aria-hidden="true"
              className="text-brand-text mt-0.5 shrink-0"
              size={22}
            />
            <div>
              <h2
                className="text-brand-text text-base font-bold"
                id="preview-notice-heading"
              >
                Preview listing — this business is fictional
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Everything on this page is design seed content used while real
                vendor onboarding is built. It is not a real business, carries
                no ratings, reviews or verification, and cannot receive
                enquiries or be shortlisted.
              </p>
            </div>
          </aside>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-5 pt-5 md:px-8">
        <h2 className="sr-only">Portfolio</h2>
        <div
          className={`grid gap-3 overflow-hidden rounded-[2rem] ${rest.length ? "md:grid-cols-[1.5fr_0.5fr]" : ""}`}
        >
          <div className="bg-muted relative min-h-[25rem] overflow-hidden md:min-h-[34rem]">
            <Image
              alt={cover.alt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 768px) 72vw, 100vw"
              src={cover.url}
            />
          </div>
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              {rest.slice(0, 2).map((item) => (
                <div
                  className="bg-muted relative min-h-44 overflow-hidden"
                  key={item.url}
                >
                  <Image
                    alt={item.alt}
                    className="object-cover"
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    src={item.url}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        {rest.length > 2 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {rest.slice(2).map((item) => (
              <div
                className="bg-muted relative aspect-square overflow-hidden rounded-2xl"
                key={item.url}
              >
                <Image
                  alt={item.alt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 16vw, 33vw"
                  src={item.url}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 md:px-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <div className="border-border flex flex-col justify-between gap-5 border-b pb-8 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="type-title md:text-5xl">{vendor.name}</h1>
                {vendor.verified && (
                  <span className="text-success inline-flex items-center gap-1 rounded-full bg-[color:var(--success-soft)] px-3 py-1 text-xs font-bold">
                    <BadgeCheck aria-hidden="true" size={15} /> Verified
                    business
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-3 inline-flex items-center gap-2">
                <MapPin aria-hidden="true" size={17} /> {vendor.locality}
                {metro ? `, ${metro.name}` : ""}
              </p>
            </div>
            {vendor.listingId ? (
              <ShortlistButton
                listingId={vendor.listingId}
                returnTo={`/vendor/${vendor.slug}`}
                variant="full"
                vendorName={vendor.name}
              />
            ) : (
              <p className="border-border text-muted-foreground w-fit rounded-full border border-dashed px-4 py-2.5 text-sm font-semibold">
                Preview listings cannot be shortlisted
              </p>
            )}
          </div>

          <div className="border-border grid gap-5 border-b py-7 sm:grid-cols-3">
            <div>
              <h2 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Rating
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <RatingBadge
                  rating={vendor.rating}
                  reviewCount={vendor.reviewCount}
                />
                <span className="text-muted-foreground text-sm font-medium">
                  {formatReviewCount(vendor.reviewCount)}
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Experience
              </h2>
              <p className="mt-2 text-lg font-bold">
                {formatYearsInBusiness(vendor.yearsInBusiness)}
              </p>
            </div>
            {vendor.responseTime && (
              <div>
                <h2 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  Response
                </h2>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Clock aria-hidden="true" size={17} /> {vendor.responseTime}
                </p>
              </div>
            )}
          </div>

          <article className="py-9">
            <p className="text-brand-text eyebrow">About</p>
            <h2 className="type-title mt-2">A closer look at {vendor.name}</h2>
            <p className="text-muted-foreground mt-5 max-w-3xl leading-8 whitespace-pre-wrap">
              {vendor.description}
            </p>
            {vendor.tags.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2">
                {vendor.tags.map((tag) => (
                  <li
                    className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
                    key={tag}
                  >
                    <Check
                      aria-hidden="true"
                      className="text-success"
                      size={15}
                    />{" "}
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </article>

          {!preview && (
            <section
              aria-labelledby="reviews-heading"
              className="border-border border-t py-9"
            >
              <h2 className="type-title" id="reviews-heading">
                Reviews
              </h2>
              {reviews.length === 0 ? (
                <p className="text-muted-foreground mt-4 leading-7">
                  No published reviews yet. Reviews can only be written by
                  customers who sent an enquiry through this marketplace, so
                  they appear once the first celebrations are complete.
                </p>
              ) : (
                <ul className="mt-6 space-y-5">
                  {reviews.map((review) => (
                    <li
                      className="border-border rounded-3xl border bg-white p-6"
                      key={review.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <RatingStars value={review.rating} />
                        <p className="text-muted-foreground text-xs">
                          {formatEventDate(review.createdAt.slice(0, 10))}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-3 leading-7 whitespace-pre-wrap">
                        {review.body}
                      </p>
                      {review.vendorReply && (
                        <div className="bg-muted mt-4 rounded-2xl p-4">
                          <p className="text-xs font-bold tracking-wider uppercase">
                            Reply from {vendor.name}
                          </p>
                          <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">
                            {review.vendorReply}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {travels && (
            <p className="text-muted-foreground mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              <MapPin
                aria-hidden="true"
                className="text-brand-text"
                size={15}
              />
              {travels} from {vendor.locality}
            </p>
          )}

          {/* Preview fixtures are fictional, so there is nothing to report and
              nothing a moderator could act on. */}
          {!preview && vendor.listingId && (
            <ReportListingForm listingId={vendor.listingId} />
          )}
        </div>

        <aside
          aria-labelledby="enquiry-panel-heading"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="border-border shadow-warm rounded-3xl border bg-white p-6">
            <h2 className="sr-only" id="enquiry-panel-heading">
              Pricing and enquiry
            </h2>
            <p className="text-muted-foreground text-sm">Starting from</p>
            <p className="mt-1 text-3xl font-bold">{price.amount}</p>
            {price.unit && (
              <p className="text-muted-foreground mt-1 text-sm font-semibold">
                {price.unit}
              </p>
            )}
            <div className="bg-muted mt-6 rounded-2xl p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold">
                <LockKeyhole
                  aria-hidden="true"
                  className="text-brand-text"
                  size={17}
                />{" "}
                Contact details are private
              </p>
              <p className="text-muted-foreground mt-2 text-xs leading-5">
                Phone and email are released only after a signed-in customer
                submits a valid enquiry. Every reveal is recorded.
              </p>
            </div>
            {vendor.listingId ? (
              <Link
                className="bg-brand-solid hover:bg-brand-solid-hover mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white transition"
                href={`/vendor/${vendor.slug}/enquire`}
              >
                <MessageCircle aria-hidden="true" size={18} /> Enquire and
                reveal contact
              </Link>
            ) : (
              <p className="border-border text-muted-foreground mt-5 rounded-2xl border border-dashed p-4 text-center text-sm font-semibold">
                Preview profiles cannot receive enquiries.
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-center text-xs">
              No contact information is included in this public page.
            </p>
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="border-border bg-muted/45 border-t">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
            <h2 className="type-title">You may also like</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <VendorCard headingLevel="h3" key={item.slug} vendor={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
