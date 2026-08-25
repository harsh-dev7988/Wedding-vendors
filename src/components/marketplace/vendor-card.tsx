import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";

import { RatingBadge } from "@/components/ui/rating";
import { isPreviewVendor, type PublicVendor } from "@/domain/marketplace";
import { formatReviewCount, formatStartingPrice } from "@/lib/format";

import { ShortlistButton } from "./shortlist-button";

type VendorCardProps = {
  readonly vendor: PublicVendor;
  /** `h2` in a results list, `h3` under a "You may also like" heading. */
  readonly headingLevel?: "h2" | "h3";
  readonly priority?: boolean;
};

export function VendorCard({
  vendor,
  headingLevel: Heading = "h2",
  priority = false,
}: VendorCardProps) {
  const preview = isPreviewVendor(vendor);
  const price = formatStartingPrice(vendor.startingPrice, vendor.priceUnit);

  return (
    <article className="group border-border shadow-soft hover:border-brand-text/30 motion-lift overflow-hidden rounded-[1.75rem] border bg-white">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        <Link
          aria-label={`View ${vendor.name}`}
          className="absolute inset-0 z-10"
          href={`/vendor/${vendor.slug}`}
        >
          <Image
            alt={vendor.imageAlt}
            className="motion-zoom object-cover"
            fill
            priority={priority}
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
            src={vendor.image}
          />
        </Link>
        <span className="absolute top-4 left-4 z-20 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur">
          {vendor.locality}
        </span>
        {preview ? (
          <span className="bg-foreground/90 absolute right-4 bottom-4 z-20 rounded-full px-3 py-1 text-xs font-bold text-white backdrop-blur">
            Preview — fictional listing
          </span>
        ) : (
          <div className="absolute top-4 right-4 z-20">
            <ShortlistButton
              listingId={vendor.listingId!}
              returnTo={`/vendor/${vendor.slug}`}
              vendorName={vendor.name}
            />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Heading className="text-xl font-bold break-words">
              <Link
                className="link-underline hover:text-brand-text transition"
                href={`/vendor/${vendor.slug}`}
              >
                {vendor.name}
              </Link>
            </Heading>
            <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
              <MapPin aria-hidden="true" size={14} /> {vendor.locality}
            </p>
          </div>
          <RatingBadge
            rating={vendor.rating}
            reviewCount={vendor.reviewCount}
          />
        </div>
        <p className="text-muted-foreground mt-4 line-clamp-2 text-sm leading-6">
          {vendor.summary}
        </p>
        <div className="border-border mt-5 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Starting from</p>
            <p className="mt-0.5 font-bold break-words">
              {price.amount}
              {price.unit ? (
                <span className="text-muted-foreground text-xs font-medium">
                  {" "}
                  {price.unit}
                </span>
              ) : null}
            </p>
          </div>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-semibold">
            {vendor.verified && (
              <BadgeCheck
                aria-hidden="true"
                className="text-success"
                size={16}
              />
            )}
            {preview ? "Design fixture" : formatReviewCount(vendor.reviewCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
