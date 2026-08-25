"use client";

import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Category = {
  readonly description: string;
  readonly name: string;
  readonly slug: string;
  readonly symbol: string;
};

type City = { readonly name: string; readonly slug: string };

/**
 * Category dropdown for the primary navigation.
 *
 * The header previously hardcoded four links and silently omitted two of the
 * five launch categories, so a visitor could not reach caterers or planners
 * from the navbar at all.
 *
 * Open state is derived from the pathname it was opened on, so a client-side
 * navigation closes it without an effect.
 */
export function CategoryMenu({
  categories,
  cities,
}: {
  readonly categories: readonly Category[];
  readonly cities: readonly City[];
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenPath(null);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenPath(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls="category-menu"
        aria-expanded={open}
        className="header-link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition"
        onClick={() => setOpenPath(open ? null : pathname)}
        ref={toggleRef}
        type="button"
      >
        Browse vendors
        <ChevronDown
          aria-hidden="true"
          className={`transition ${open ? "rotate-180" : ""}`}
          size={15}
        />
      </button>

      {open && (
        <div
          className="border-border shadow-soft absolute top-12 left-1/2 z-50 w-[min(44rem,90vw)] -translate-x-1/2 rounded-2xl border bg-white p-4"
          id="category-menu"
        >
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-muted-foreground px-2 text-xs font-bold tracking-widest uppercase">
                By category
              </p>
              <ul className="mt-2 grid gap-0.5">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      className="hover:bg-muted flex items-start gap-3 rounded-xl px-2 py-2 transition"
                      href={`/vendors?category=${category.slug}`}
                    >
                      <span aria-hidden="true" className="mt-0.5 text-lg">
                        {category.symbol}
                      </span>
                      <span>
                        <span className="block text-sm font-bold">
                          {category.name}
                        </span>
                        <span className="text-muted-foreground block text-xs leading-5">
                          {category.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-border sm:border-l sm:pl-4">
              <p className="text-muted-foreground px-2 text-xs font-bold tracking-widest uppercase">
                By city
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-0.5 sm:grid-cols-1">
                {cities.map((city) => (
                  <li key={city.slug}>
                    <Link
                      className="hover:bg-muted flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition"
                      // The city hub, not `/vendors?city=…`: the search page is
                      // noindex by design, so linking it from every page sent
                      // the site's internal link equity to a dead end.
                      href={`/vendors/${city.slug}`}
                    >
                      <MapPin
                        aria-hidden="true"
                        className="text-brand-text shrink-0"
                        size={14}
                      />
                      {city.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                className="text-brand-text hover:bg-muted mt-1 flex min-h-10 items-center rounded-xl px-2 text-sm font-bold transition"
                href="/vendors"
              >
                See all vendors →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
