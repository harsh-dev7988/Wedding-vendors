"use client";

import { useEffect } from "react";

import { setCity } from "@/lib/city-context";

/**
 * Records the city of the page being viewed.
 *
 * The city is learned by watching, not by asking. Somebody who opens a Pune
 * directory has told us where they are more reliably than a permission prompt
 * would, and most visitors will never see the prompt at all because this fires
 * first.
 *
 * Renders nothing, so it can sit inside a prerendered page without making any
 * of it dynamic — the effect runs in the browser, after the HTML that was
 * already cached.
 */
export function RememberCity({ slug }: { readonly slug: string }) {
  useEffect(() => {
    setCity(slug);
  }, [slug]);

  return null;
}
