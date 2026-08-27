"use client";

import { MapPin, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { PlaceCombobox } from "@/components/maps/place-combobox";
import { isPlausibleIndianCoordinate } from "@/lib/geo";
import { photonProvider } from "@/lib/maps/photon";
import type { PlaceSuggestion } from "@/lib/maps/types";
import { createClient } from "@/lib/supabase/client";

/**
 * The map canvas is the only heavy part, and it is only ever needed on this
 * form. `ssr: false` because Leaflet touches `window` on import.
 */
const LeafletCanvas = dynamic(
  () => import("@/components/maps/leaflet-canvas").then((m) => m.LeafletCanvas),
  {
    loading: () => (
      <div className="bg-muted h-72 w-full animate-pulse rounded-2xl" />
    ),
    ssr: false,
  },
);

export type PickedLocation = {
  /** Resolved from the point, so the vendor is not asked which city twice. */
  readonly citySlug?: string;
  readonly lat: number;
  readonly lng: number;
  readonly locality: string;
  readonly streetAddress: string;
};

/**
 * Address entry for the listing form.
 *
 * The vendor types their address and picks a suggestion; the map then shows
 * where we placed them. That confirmation step is the point — a geocoder is
 * accurate for a mapped street and can be a kilometre out for a farmhouse on an
 * unnamed road, and the vendor is the only person who can tell the difference.
 *
 * The marker is draggable for exactly that case. It is a correction, not a
 * step: nobody has to touch it. A drag re-geocodes, because the locality is the
 * only location string published and a stale one would advertise the wrong
 * neighbourhood.
 *
 * The provider is swappable — see lib/maps/types.ts. Photon needs no key and no
 * billing account, which is why it is the default.
 */
export function LocationPicker({
  defaultValue,
  onChange,
}: {
  readonly defaultValue?: PickedLocation | null;
  readonly onChange: (value: PickedLocation | null) => void;
}) {
  const provider = photonProvider;
  const [picked, setPicked] = useState<PickedLocation | null>(
    defaultValue ?? null,
  );
  const [warning, setWarning] = useState<string | null>(null);
  const reverseRef = useRef<AbortController | null>(null);

  /**
   * Which of our cities the point falls nearest to. The vendor's declared city
   * and their address should not be two independent answers to one question.
   */
  const resolveCity = useCallback(async (lat: number, lng: number) => {
    try {
      const { data } = await createClient().rpc("get_nearest_city", {
        origin_lat: lat,
        origin_lng: lng,
      });
      const nearest = Array.isArray(data) ? data[0] : null;
      return (nearest?.slug as string | undefined) ?? undefined;
    } catch {
      // Not fatal — the vendor can still pick a city by hand.
      return undefined;
    }
  }, []);

  const publish = useCallback(
    async (next: PickedLocation) => {
      if (!isPlausibleIndianCoordinate(next.lat, next.lng)) {
        setWarning("That location is outside India. Please choose another.");
        return;
      }
      setWarning(null);
      setPicked(next);
      onChange(next);

      const citySlug = await resolveCity(next.lat, next.lng);
      if (!citySlug || citySlug === next.citySlug) return;
      const withCity = { ...next, citySlug };
      setPicked(withCity);
      onChange(withCity);
    },
    [onChange, resolveCity],
  );

  const onSelect = (place: PlaceSuggestion) => {
    void publish({
      lat: place.lat,
      lng: place.lng,
      locality: place.locality,
      streetAddress: place.formattedAddress,
    });
  };

  /**
   * A drag moves the point immediately and re-geocodes behind it. If the lookup
   * fails the point still moves and the previous label stands — refusing the
   * correction the vendor came here to make would be the worse outcome.
   */
  // Recreated whenever `picked` changes; the canvas holds it behind an
  // effect-synced ref, so the marker handler always calls the current one.
  const onMove = (lat: number, lng: number) => {
    const current = picked;
    if (!current) return;
    void publish({ ...current, lat, lng });

    reverseRef.current?.abort();
    const controller = new AbortController();
    reverseRef.current = controller;

    provider
      .reverse(lat, lng, controller.signal)
      .then((place) => {
        if (!place) return;
        void publish({
          lat,
          lng,
          locality: place.locality || current.locality,
          streetAddress: place.formattedAddress || current.streetAddress,
        });
      })
      .catch(() => {
        // Keep the moved point and the previous label.
      });
  };

  return (
    <div className="space-y-3">
      <PlaceCombobox
        defaultValue={defaultValue?.streetAddress}
        onSelect={onSelect}
        provider={provider}
      />

      {warning && (
        <p className="text-brand-text flex items-start gap-2 text-sm font-semibold">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={15}
          />
          {warning}
        </p>
      )}

      <LeafletCanvas
        attribution={provider.attribution}
        lat={picked?.lat ?? null}
        lng={picked?.lng ?? null}
        onMove={onMove}
      />

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
        <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
        {picked
          ? "Not quite right? Drag the marker to the exact spot. Your address is never shown publicly — customers only see the neighbourhood and how far away you are."
          : "Search for your address above. Your exact location is never shown publicly."}
      </p>
    </div>
  );
}
