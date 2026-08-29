import { NextResponse } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";
import { isPlausibleIndianCoordinate } from "@/lib/geo";

/**
 * The launch city nearest a coordinate, or nothing if none is close.
 *
 * The city prompt needs this because the city list lives in the database and
 * changes without a deploy — a lookup table in the browser would be wrong the
 * day a city is added. `get_nearest_city` is the same function the pincode
 * resolver uses, so the browser and the importer agree on what "nearest" means.
 *
 * It returns a city name and slug, both already public. No coordinate is
 * echoed back, and none is stored: the caller's position is used to answer the
 * question and then discarded.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number.parseFloat(url.searchParams.get("lat") ?? "");
  const lng = Number.parseFloat(url.searchParams.get("lng") ?? "");

  if (!isPlausibleIndianCoordinate(lat, lng)) {
    return NextResponse.json({ error: "invalid-coordinate" }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_nearest_city", {
    origin_lat: lat,
    origin_lng: lng,
  });

  const nearest = Array.isArray(data) ? data[0] : data;
  if (error || !nearest?.slug) {
    return NextResponse.json({ slug: null }, { status: 200 });
  }

  return NextResponse.json(
    { name: nearest.name ?? null, slug: nearest.slug },
    // A coordinate is personal; nothing about this answer should be cached by
    // a proxy on the way back.
    { headers: { "cache-control": "no-store" }, status: 200 },
  );
}
