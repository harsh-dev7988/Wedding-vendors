"use client";

import { MapPin, TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  Autocomplete,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";

import { isPlausibleIndianCoordinate } from "@/lib/geo";

/** Module-level constant: a new array each render remounts the Maps loader. */
const LIBRARIES: "places"[] = ["places"];

const MAP_STYLE = { borderRadius: "1rem", height: "18rem", width: "100%" };

/**
 * `sublocality` is the neighbourhood ("Vasant Kunj"); `locality` is the city.
 * The neighbourhood is the useful public label, so it is preferred.
 */
function localityFrom(
  components: google.maps.GeocoderAddressComponent[] | undefined,
) {
  const pick = (type: string) =>
    components?.find((component) => component.types.includes(type))?.long_name;
  return (
    pick("sublocality_level_1") ??
    pick("sublocality") ??
    pick("neighborhood") ??
    pick("locality") ??
    ""
  );
}

export type PickedLocation = {
  readonly lat: number;
  readonly lng: number;
  readonly locality: string;
  readonly streetAddress: string;
};

/**
 * Address entry for the listing form.
 *
 * The vendor types their address and picks a Places suggestion; the map then
 * shows where we placed them. That confirmation step is the point — Places is
 * accurate for a business already on Google Maps and can be a kilometre or two
 * out for a farmhouse on an unnamed road, and the vendor is the only person
 * who can tell the difference.
 *
 * The marker is draggable for exactly that case. It is a correction, not a
 * step: nobody has to touch it.
 *
 * A session token groups the whole typing session plus one Place Details call
 * into a single billable unit. Without it Google bills per keystroke.
 */
export function LocationPicker({
  defaultValue,
  onChange,
}: {
  readonly defaultValue?: PickedLocation | null;
  readonly onChange: (value: PickedLocation | null) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const [picked, setPicked] = useState<PickedLocation | null>(
    defaultValue ?? null,
  );
  const [warning, setWarning] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const publish = useCallback(
    (next: PickedLocation | null) => {
      setPicked(next);
      onChange(next);
    },
    [onChange],
  );

  const moveTo = useCallback(
    (lat: number, lng: number, streetAddress: string, locality: string) => {
      if (!isPlausibleIndianCoordinate(lat, lng)) {
        setWarning("That location is outside India. Please choose another.");
        return;
      }
      setWarning(null);
      publish({ lat, lng, locality, streetAddress });
      mapRef.current?.panTo({ lat, lng });
    },
    [publish],
  );

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    const point = place?.geometry?.location;
    if (!point) {
      setWarning("Pick a suggestion from the list so we can locate you.");
      return;
    }
    // Consumed — the next keystroke starts a fresh billable session.
    sessionTokenRef.current = null;

    const locality = localityFrom(place.address_components);

    moveTo(
      point.lat(),
      point.lng(),
      place.formatted_address ?? place.name ?? "",
      locality,
    );
    mapRef.current?.setZoom(16);
  };

  /**
   * Dragging used to move the point while leaving the address and locality
   * untouched. The locality is the only location string published, so a vendor
   * who nudged the pin two kilometres was left advertising the wrong
   * neighbourhood. Reverse geocoding keeps the label honest.
   *
   * If the lookup fails the point still moves — a slightly stale label is a far
   * better outcome than refusing the correction the vendor came here to make.
   */
  const onMarkerDragEnd = (event: google.maps.MapMouseEvent) => {
    const point = event.latLng;
    if (!point || !picked) return;

    const lat = point.lat();
    const lng = point.lng();
    moveTo(lat, lng, picked.streetAddress, picked.locality);

    geocoderRef.current ??= new google.maps.Geocoder();
    geocoderRef.current
      .geocode({ location: { lat, lng } })
      .then(({ results }) => {
        const best = results[0];
        if (!best) return;
        moveTo(
          lat,
          lng,
          best.formatted_address ?? picked.streetAddress,
          localityFrom(best.address_components) || picked.locality,
        );
      })
      .catch(() => {
        // Keep the moved point and the previous label.
      });
  };

  if (!apiKey) {
    return (
      <p className="border-border text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
        Map search is not configured yet. A moderator can set the location for
        you after you submit.
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="border-border text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
        Google Maps could not be loaded. You can still submit; a moderator will
        set the location.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {isLoaded ? (
        <Autocomplete
          onLoad={(instance) => {
            autocompleteRef.current = instance;
            sessionTokenRef.current =
              new google.maps.places.AutocompleteSessionToken();
          }}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: "in" },
            fields: [
              "geometry.location",
              "formatted_address",
              "name",
              "address_components",
            ],
          }}
        >
          <input
            className="border-border focus:border-brand-text min-h-12 w-full rounded-xl border bg-white px-3 font-medium"
            defaultValue={defaultValue?.streetAddress}
            placeholder="Start typing your address or business name…"
            type="text"
          />
        </Autocomplete>
      ) : (
        <div className="bg-muted h-12 w-full animate-pulse rounded-xl" />
      )}

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

      {isLoaded ? (
        <GoogleMap
          center={
            picked
              ? { lat: picked.lat, lng: picked.lng }
              : { lat: 22.9, lng: 78.6 }
          }
          mapContainerStyle={MAP_STYLE}
          onLoad={(instance) => {
            mapRef.current = instance;
          }}
          onUnmount={() => {
            mapRef.current = null;
          }}
          options={{
            fullscreenControl: false,
            mapTypeControl: false,
            streetViewControl: false,
          }}
          zoom={picked ? 16 : 4}
        >
          {picked && (
            <Marker
              draggable
              onDragEnd={onMarkerDragEnd}
              position={{ lat: picked.lat, lng: picked.lng }}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="bg-muted h-72 w-full animate-pulse rounded-2xl" />
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
        <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
        {picked
          ? "Not quite right? Drag the marker to the exact spot. Your address is never shown publicly — customers only see the neighbourhood and how far away you are."
          : "Search for your address above. Your exact location is never shown publicly."}
      </p>
    </div>
  );
}
