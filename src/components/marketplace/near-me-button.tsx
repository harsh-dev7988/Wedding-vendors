"use client";

import { LoaderCircle, LocateFixed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { isPlausibleIndianCoordinate } from "@/lib/geo";

type Status = "idle" | "locating" | "denied" | "unavailable" | "outside";

const MESSAGES: Partial<Record<Status, string>> = {
  denied: "Location permission was declined. Pick a city instead.",
  outside: "You appear to be outside India. Pick a city instead.",
  unavailable: "We could not work out where you are. Pick a city instead.",
};

/**
 * "Use my location" — resolves the browser's coordinates to the nearest
 * supported city and navigates there, sorted by distance.
 *
 * Geolocation is requested on click and never on load: a permission prompt
 * that appears unbidden is refused far more often, and a refusal is sticky.
 * Every failure path leaves the page exactly as it was.
 */
export function NearMeButton({ category }: { readonly category?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (!isPlausibleIndianCoordinate(latitude, longitude)) {
          setStatus("outside");
          return;
        }

        const { data, error } = await createClient().rpc("get_nearest_city", {
          origin_lat: latitude,
          origin_lng: longitude,
        });
        const nearest = Array.isArray(data) ? data[0] : null;
        if (error || !nearest) {
          setStatus("unavailable");
          return;
        }

        // The coordinates ride in the query string so the results page can sort
        // by real distance rather than snapping everyone to a city centroid.
        const params = new URLSearchParams({
          city: nearest.slug,
          lat: latitude.toFixed(5),
          lng: longitude.toFixed(5),
          sort: "distance",
        });
        if (category) params.set("category", category);
        router.push(`/vendors?${params}`);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <div>
      <button
        className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold transition disabled:opacity-60"
        disabled={status === "locating"}
        onClick={locate}
        type="button"
      >
        {status === "locating" ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <LocateFixed
            aria-hidden="true"
            className="text-brand-text"
            size={16}
          />
        )}
        {status === "locating" ? "Finding you…" : "Use my location"}
      </button>
      {MESSAGES[status] && (
        <p aria-live="polite" className="text-muted-foreground mt-2 text-xs">
          {MESSAGES[status]}
        </p>
      )}
    </div>
  );
}
