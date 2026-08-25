import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A rating chip that degrades honestly.
 *
 * A brand-new listing has no rating, and rendering "0" in a green badge read as
 * a bad score rather than an absent one.
 */
export function RatingBadge({
  className,
  rating,
  reviewCount,
}: {
  className?: string;
  rating: number | null;
  reviewCount: number;
}) {
  if (rating === null || reviewCount === 0) {
    return (
      <span
        className={cn(
          "text-muted-foreground bg-muted inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold",
          className,
        )}
      >
        New listing
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-success inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--success-soft)] px-2.5 py-1 text-sm font-bold",
        className,
      )}
    >
      <Star aria-hidden="true" fill="currentColor" size={13} />
      <span aria-hidden="true">{rating.toFixed(1)}</span>
      <span className="sr-only">
        Rated {rating.toFixed(1)} out of 5 from {reviewCount}{" "}
        {reviewCount === 1 ? "review" : "reviews"}
      </span>
    </span>
  );
}

/** Row of stars used inside an individual review. */
export function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          aria-hidden="true"
          className={step <= value ? "text-brand-solid" : "text-border"}
          fill="currentColor"
          key={step}
          size={15}
        />
      ))}
      <span className="sr-only">{value} out of 5</span>
    </span>
  );
}
