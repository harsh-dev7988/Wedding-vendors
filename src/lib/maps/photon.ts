import type { MapsProvider, PlaceSuggestion } from "./types";

/**
 * Geocoding via Photon, which is OpenStreetMap data served by Komoot.
 *
 * Nominatim is the obvious choice and the wrong one: its usage policy
 * explicitly prohibits autocomplete, so a search-as-you-type box built on it
 * violates the terms and gets the IP blocked. Photon exists precisely for
 * type-ahead, needs no key and no account, and returns the same OSM data.
 *
 * No API key means nothing to restrict, nothing to leak and nothing to hand
 * over — which is the whole reason this is the default.
 */

const ENDPOINT = "https://photon.komoot.io/api/";
const REVERSE_ENDPOINT = "https://photon.komoot.io/reverse";

/** Biases results towards India rather than restricting to it — Photon has no
 *  country filter, so a central point plus the bounding box does the work. */
const INDIA_CENTRE = { lat: 22.9, lon: 78.6 };

/**
 * Photon occasionally answers with an HTML error page under a 200, which
 * `response.json()` throws on. A geocoder hiccup must not surface as a crash
 * in the form, so parsing is defensive and a bad body is simply "no results".
 */
async function features(url: URL, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  if (!response.headers.get("content-type")?.includes("json")) return [];
  try {
    const data = (await response.json()) as { features?: PhotonFeature[] };
    return data.features ?? [];
  } catch {
    return [];
  }
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    city?: string;
    locality?: string;
    country?: string;
    county?: string;
    district?: string;
    housenumber?: string;
    name?: string;
    osm_id?: number;
    postcode?: string;
    state?: string;
    street?: string;
    suburb?: string;
  };
};

/** The neighbourhood, preferred over the city — it is the public label. */
function localityOf(p: PhotonFeature["properties"]) {
  return p.suburb ?? p.locality ?? p.district ?? p.county ?? p.city ?? "";
}

function addressOf(p: PhotonFeature["properties"]) {
  return [
    [p.housenumber, p.street].filter(Boolean).join(" "),
    p.name && p.name !== p.street ? p.name : null,
    p.suburb,
    p.city,
    p.state,
    p.postcode,
  ]
    .filter(Boolean)
    .join(", ");
}

function toSuggestion(feature: PhotonFeature, index: number): PlaceSuggestion {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  const address = addressOf(props);
  return {
    formattedAddress: address,
    id: String(props.osm_id ?? `${lat},${lng},${index}`),
    label: props.name ? `${props.name} — ${address}` : address,
    lat,
    lng,
    locality: localityOf(props),
  };
}

/** Photon has no country restriction, so non-Indian results are dropped here. */
const inIndia = (s: PlaceSuggestion) =>
  s.lat >= 6 && s.lat <= 37.5 && s.lng >= 68 && s.lng <= 97.5;

export const photonProvider: MapsProvider = {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · search by <a href="https://photon.komoot.io">Photon</a>',
  name: "leaflet",

  async suggest(query, signal) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set("lat", String(INDIA_CENTRE.lat));
    url.searchParams.set("lon", String(INDIA_CENTRE.lon));

    return (await features(url, signal))
      .map(toSuggestion)
      .filter(inIndia)
      .filter((suggestion) => suggestion.formattedAddress.length > 0);
  },

  async reverse(lat, lng, signal) {
    const url = new URL(REVERSE_ENDPOINT);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));

    const feature = (await features(url, signal))[0];
    return feature ? toSuggestion(feature, 0) : null;
  },
};
