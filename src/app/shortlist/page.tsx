import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Search } from "lucide-react";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { formatServiceRadius } from "@/lib/geo";
import { formatStartingPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { removeFromShortlist } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your shortlist",
  robots: { index: false, follow: false },
};

type ShortlistRow = {
  listing_id: string;
  listings: {
    locality: string | null;
    service_radius_m: number | null;
    price_from: number | null;
    price_unit:
      | "per_plate"
      | "per_event"
      | "per_function"
      | "per_day"
      | "package"
      | "on_request";
    slug: string;
    status: string;
    summary: string;
    title: string;
  } | null;
};

const MESSAGES: Record<string, string> = {
  removed: "Removed from your shortlist.",
  saved: "Saved to your shortlist.",
};

const ERRORS: Record<string, string> = {
  failed: "That shortlist change could not be saved. Please try again.",
  invalid: "That listing could not be found.",
  unavailable:
    "That listing is no longer published, so it cannot be shortlisted.",
};

export default async function ShortlistPage({
  searchParams,
}: PageProps<"/shortlist">) {
  const viewer = await getViewer();
  const params = await searchParams;
  const flag = typeof params.shortlist === "string" ? params.shortlist : null;
  const configured = isSupabaseConfigured();

  if (!viewer) {
    return (
      <main
        className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center"
        id="main-content"
      >
        <span className="bg-brand-soft text-brand-text rounded-full p-4">
          <Heart aria-hidden="true" size={28} />
        </span>
        <h1 className="type-title mt-6">Keep your wedding team together</h1>
        <p className="text-muted-foreground mt-4 max-w-xl leading-7">
          Sign in to save approved live listings across devices. Preview
          profiles remain browse-only.
        </p>
        {configured ? (
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover mt-7 inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition"
            href="/sign-in?next=/shortlist"
          >
            Sign in to view shortlist
          </Link>
        ) : (
          <p className="border-border text-muted-foreground mt-7 rounded-full border border-dashed px-5 py-3 text-sm font-semibold">
            Sign-in activates once the Supabase connection is configured.
          </p>
        )}
      </main>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shortlists")
    .select(
      "listing_id, listings(title, slug, summary, locality, price_from, price_unit, service_radius_m, status)",
    )
    .eq("customer_id", viewer.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as ShortlistRow[];
  // A listing that was unpublished after being saved becomes unreadable under
  // RLS. Counting those rows as items produced an empty grid with no empty
  // state and no explanation.
  const items = rows.filter((row) => row.listings !== null);
  const hiddenCount = rows.length - items.length;

  return (
    <main
      className="mx-auto min-h-[55vh] max-w-5xl px-5 py-14 md:px-8"
      id="main-content"
    >
      <p className="text-brand-text eyebrow">Customer shortlist</p>
      <h1 className="type-page mt-3">Your saved vendors</h1>

      <div className="mt-6 space-y-3">
        {flag && MESSAGES[flag] && (
          <StatusBanner>{MESSAGES[flag]}</StatusBanner>
        )}
        {flag && ERRORS[flag] && <FormAlert>{ERRORS[flag]}</FormAlert>}
        {error && (
          <FormAlert>
            Your shortlist could not be loaded. Please refresh the page.
          </FormAlert>
        )}
        {hiddenCount > 0 && (
          <p className="border-border text-muted-foreground rounded-2xl border border-dashed p-4 text-sm leading-6">
            {hiddenCount} saved{" "}
            {hiddenCount === 1 ? "listing is" : "listings are"} no longer
            published and {hiddenCount === 1 ? "is" : "are"} hidden.
          </p>
        )}
      </div>

      {items.length > 0 ? (
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {items.map((item) => {
            const listing = item.listings!;
            const price = formatStartingPrice(
              listing.price_from,
              listing.price_unit.replaceAll("_", " ") as never,
            );

            return (
              <article
                className="border-border shadow-soft rounded-3xl border bg-white p-6"
                key={item.listing_id}
              >
                <p className="text-muted-foreground text-sm">
                  {listing.locality}
                  {formatServiceRadius(listing.service_radius_m) && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {formatServiceRadius(listing.service_radius_m)}
                    </span>
                  )}
                </p>
                <h2 className="type-heading mt-2">
                  <Link
                    className="hover:text-brand-text transition"
                    href={`/vendor/${listing.slug}`}
                  >
                    {listing.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {listing.summary}
                </p>
                <p className="mt-4 text-sm font-bold">{price.amount}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    className="bg-brand-solid hover:bg-brand-solid-hover inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white transition"
                    href={`/vendor/${listing.slug}`}
                  >
                    View profile
                  </Link>
                  <form action={removeFromShortlist}>
                    <input
                      name="listingId"
                      type="hidden"
                      value={item.listing_id}
                    />
                    <SubmitButton
                      className="border-border hover:border-brand-text/50 min-h-11 rounded-full border px-4 text-sm"
                      pendingLabel="Removing…"
                    >
                      Remove
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border-border mt-10 rounded-[2rem] border border-dashed p-10 text-center">
          <Heart aria-hidden="true" className="text-brand-text mx-auto" />
          <h2 className="type-heading mt-4">Nothing saved yet</h2>
          <p className="text-muted-foreground mt-3">
            Only approved live listings can be saved.
          </p>
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition"
            href="/vendors"
          >
            <Search aria-hidden="true" size={17} /> Explore vendors
          </Link>
        </div>
      )}
    </main>
  );
}
