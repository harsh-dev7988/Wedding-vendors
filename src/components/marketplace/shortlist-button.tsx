"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { toggleShortlist } from "@/app/shortlist/actions";
import { cn } from "@/lib/utils";

import {
  loadShortlist,
  setShortlisted,
  subscribeToShortlist,
} from "./shortlist-store";

type ShortlistButtonProps = {
  readonly listingId: string;
  readonly returnTo: string;
  readonly vendorName: string;
  readonly variant?: "icon" | "full";
};

/**
 * A working shortlist control.
 *
 * The card used to render an `aria-hidden` heart in the canonical save
 * position that was not focusable, not clickable and had no state — the most
 * prominent "looks interactive but does nothing" element in the product.
 *
 * This is a real `<form>` bound to a Server Action, so it still submits with
 * JavaScript disabled; the client parts only add pressed state and an
 * optimistic icon.
 */
export function ShortlistButton({
  listingId,
  returnTo,
  vendorName,
  variant = "icon",
}: ShortlistButtonProps) {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    loadShortlist().then((ids) => {
      if (active) setSaved(ids.has(listingId));
    });
    const unsubscribe = subscribeToShortlist((ids) => {
      if (active) setSaved(ids.has(listingId));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [listingId]);

  const label =
    saved === true
      ? `Remove ${vendorName} from your shortlist`
      : `Save ${vendorName} to your shortlist`;

  return (
    <form
      action={toggleShortlist}
      onSubmit={() => setShortlisted(listingId, !saved)}
    >
      <input name="listingId" type="hidden" value={listingId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      {variant === "icon" ? (
        <button
          aria-label={label}
          aria-pressed={saved ?? false}
          className="border-border/60 hover:border-brand-text/50 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur transition"
          type="submit"
        >
          <Heart
            aria-hidden="true"
            className={cn(saved ? "text-brand-solid" : "text-foreground")}
            fill={saved ? "currentColor" : "none"}
            size={17}
          />
        </button>
      ) : (
        <button
          aria-pressed={saved ?? false}
          className="border-border hover:border-brand-text/50 inline-flex min-h-11 w-fit items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition"
          type="submit"
        >
          <Heart
            aria-hidden="true"
            className={cn(saved ? "text-brand-solid" : "text-foreground")}
            fill={saved ? "currentColor" : "none"}
            size={17}
          />
          {saved ? "Saved" : "Shortlist"}
        </button>
      )}
    </form>
  );
}
