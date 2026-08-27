/**
 * The map layer does exactly three jobs, and only these cross the boundary:
 * turn text into candidate places, turn a point back into an address, and draw
 * a map you can drag a marker on.
 *
 * Everything else — the schema, `search_listings`, the service radius, the
 * column grants, the "distance and locality, never a coordinate" rule — is ours
 * and provider-blind. Swapping providers must not reach any of it.
 */

export type PlaceSuggestion = {
  /** Stable within one result set; used as a React key. */
  readonly id: string;
  /** What the visitor reads in the list. */
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  /** Kept for moderation, never published. */
  readonly formattedAddress: string;
  /** The neighbourhood. The only location string ever shown publicly. */
  readonly locality: string;
};

export type MapsProvider = {
  readonly name: "leaflet" | "google";
  /** Rendered on the map. Required by OpenStreetMap's licence. */
  readonly attribution: string;
  /** Autocomplete. The caller debounces and passes an AbortSignal. */
  suggest(
    query: string,
    signal: AbortSignal,
  ): Promise<readonly PlaceSuggestion[]>;
  /** Point to address, so a dragged marker updates the published locality. */
  reverse(
    lat: number,
    lng: number,
    signal: AbortSignal,
  ): Promise<PlaceSuggestion | null>;
};

export type MapCanvasProps = {
  readonly attribution: string;
  readonly lat: number | null;
  readonly lng: number | null;
  /** Fired when the vendor drags the marker to correct the pin. */
  readonly onMove: (lat: number, lng: number) => void;
};
