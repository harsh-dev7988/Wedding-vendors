"use client";

import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
  dismissCityPrompt,
  neverOnServer,
  setCity,
  shouldOfferCityPrompt,
  subscribeToCity,
} from "@/lib/city-context";
import { isPlausibleIndianCoordinate } from "@/lib/geo";

type City = { readonly name: string; readonly slug: string };

/**
 * Offers to remember a city, inline and dismissibly.
 *
 * Not a modal, and not a geolocation prompt on load. An interstitial on first
 * paint costs conversions, and a permission request fired without a gesture is
 * denied by default on iOS Safari and ignored nearly everywhere else — asking
 * that way mostly teaches people to refuse. So this sits in the page, below the
 * hero, and goes away for good when dismissed.
 *
 * Most visitors should never see it: `RememberCity` learns the city from any
 * city page they open, and this only appears when nothing has been learned yet.
 */
export function CityPrompt({ cities }: { readonly cities: readonly City[] }) {
  // The home page is prerendered and shared by everyone, so the server
  // snapshot is always false: the prompt appears after hydration or it would be
  // baked into cached HTML for visitors who have already chosen a city.
  const show = useSyncExternalStore(
    subscribeToCity,
    shouldOfferCityPrompt,
    neverOnServer,
  );
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const choose = (slug: string) => setCity(slug);
  const dismiss = () => dismissCityPrompt();

  const locate = () => {
    if (!navigator.geolocation) {
      setError("This browser cannot share a location. Pick a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (!isPlausibleIndianCoordinate(latitude, longitude)) {
          setLocating(false);
          setError("That location is outside India. Pick a city instead.");
          return;
        }
        // The nearest city is resolved by the database, which owns the city
        // list and their coordinates — a lookup table here would go stale the
        // day a city is added.
        try {
          const response = await fetch(
            `/api/nearest-city?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`,
          );
          const found = response.ok ? await response.json() : null;
          if (found?.slug) choose(found.slug);
          else setError("No launch city is near you yet. Pick one to browse.");
        } catch {
          setError("Could not work out your city. Pick one instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Location was not shared. Pick a city instead.");
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 },
    );
  };

  return (
    <section
      aria-labelledby="city-prompt-heading"
      className="border-border bg-muted/55 border-b"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:px-8 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-1 items-start gap-3">
          <MapPin
            aria-hidden="true"
            className="text-brand-text mt-0.5"
            size={18}
          />
          <div>
            <p className="text-sm font-bold" id="city-prompt-heading">
              Showing vendors across India.
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {error ?? "Set your city and we will start you there next time."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cities.slice(0, 5).map((city) => (
            <button
              className="border-border hover:border-brand-text/50 hover:text-brand-text inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold transition"
              key={city.slug}
              onClick={() => choose(city.slug)}
              type="button"
            >
              {city.name}
            </button>
          ))}
          <button
            className="bg-brand-solid hover:bg-brand-solid-hover inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-white transition disabled:opacity-60"
            disabled={locating}
            onClick={locate}
            type="button"
          >
            <MapPin aria-hidden="true" size={15} />
            {locating ? "Locating…" : "Use my location"}
          </button>
          <Link
            className="link-underline text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center px-2 text-sm font-semibold"
            href="/vendors"
          >
            See all cities
          </Link>
        </div>

        {/* Outside the wrapping group, so it stays at the end of the row
            instead of dropping onto a line of its own when the chips wrap. */}
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center self-start rounded-full transition lg:self-center"
          onClick={dismiss}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </section>
  );
}
