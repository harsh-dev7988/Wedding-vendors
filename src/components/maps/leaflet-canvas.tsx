"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import type { MapCanvasProps } from "@/lib/maps/types";

/**
 * Leaflet map with one draggable marker.
 *
 * Written against Leaflet directly rather than react-leaflet: this needs to
 * imperatively re-centre when a suggestion is picked and read a drag back out,
 * which is two escape hatches out of a declarative wrapper for no gain.
 *
 * Leaflet's default marker icon is resolved from the CSS file's own URL, which
 * a bundler rewrites — the well-known result is an invisible marker. The icon
 * is defined inline here instead so it cannot break.
 */

const CENTRE_OF_INDIA: [number, number] = [22.9, 78.6];

const MARKER = L.divIcon({
  className: "",
  html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12.2 22.7 12.72 23.26a1.75 1.75 0 0 0 2.56 0C15.8 36.7 28 23.5 28 14 28 6.27 21.73 0 14 0z" fill="#c9430a"/>
    <circle cx="14" cy="14" r="5.5" fill="#fff"/>
  </svg>`,
  iconAnchor: [14, 38],
  iconSize: [28, 38],
});

export function LeafletCanvas({
  attribution,
  lat,
  lng,
  onMove,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Held in a ref so the drag handler registered on the marker never closes
  // over a stale prop. Synced in an effect: writing a ref during render is
  // unsafe once rendering can be interrupted and restarted.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: true,
      center: CENTRE_OF_INDIA,
      scrollWheelZoom: false, // the page scrolls past this; the map must not eat it
      zoom: 4,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [attribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true, icon: MARKER })
        .addTo(map)
        .on("dragend", (event) => {
          const point = (event.target as L.Marker).getLatLng();
          onMoveRef.current(point.lat, point.lng);
        });
      markerRef.current = marker;
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [lat, lng]);

  return (
    // `isolate` is load-bearing. Leaflet gives its own panes z-index values up
    // to 1000, which outranked the address suggestions and left them rendering
    // invisibly behind the map — the list is directly above it. A stacking
    // context confines those values so they cannot escape this box.
    <div
      className="border-border isolate h-72 w-full overflow-hidden rounded-2xl border"
      ref={containerRef}
    />
  );
}
