"use client";

import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";

/** Routes whose first section is a full-bleed hero the header sits on top of. */
const OVERLAY_ROUTES = new Set(["/"]);

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * True once the page has scrolled far enough that the header is no longer over
 * the hero photograph.
 *
 * `useSyncExternalStore` rather than an effect: it reads the real scroll
 * position during render on the client and returns the server value during
 * SSR, so there is no flash of the wrong chrome and no setState-in-effect.
 */
function useScrolledPast(threshold: number) {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => window.scrollY > threshold, [threshold]),
    // On the server the page is always at the top.
    () => false,
  );
}

/**
 * Supplies the header's own styling.
 *
 * Over the hero it is transparent with light text; everywhere else — and as
 * soon as the reader scrolls past the image — it becomes the opaque cream bar,
 * because light text on a cream background is unreadable and this is a sticky
 * element that outlives the section it started on.
 */
export function HeaderChrome({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const overlay = OVERLAY_ROUTES.has(pathname);
  const scrolled = useScrolledPast(64);
  const transparent = overlay && !scrolled;

  // Positioning is decided by the route, never by scroll state. Switching
  // between fixed and sticky mid-scroll would take the header in and out of
  // the document flow and jump the page by its own height.
  const position = overlay
    ? "fixed inset-x-0 top-0"
    : "sticky top-0 backdrop-blur-xl";

  return (
    <header
      className={`z-[100] border-b transition-colors duration-300 ${position} ${
        transparent
          ? // No visible rule while transparent: a hairline drawn across the
            // photograph reads as a seam, and there is nothing above the hero
            // to separate the bar from.
            "on-dark border-transparent bg-transparent text-white"
          : "border-border/80 bg-background/90 backdrop-blur-xl"
      }`}
      data-transparent={transparent ? "true" : undefined}
    >
      {children}
    </header>
  );
}
