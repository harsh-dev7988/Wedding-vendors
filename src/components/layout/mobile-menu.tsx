"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/vendors", label: "Explore vendors" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/for-vendors", label: "For vendors" },
  { href: "/account", label: "Account" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/vendor/dashboard", label: "Vendor workspace" },
] as const;

/**
 * The menu used to be a bare `<details>`. The header lives in the root layout
 * and never remounts, so its `open` attribute survived client-side navigation
 * and the panel stayed over the new page. `<details>` also offers no Escape or
 * outside-click dismissal.
 */
export function MobileMenu() {
  const pathname = usePathname();
  // Storing the path the menu was opened on means a client-side navigation
  // closes it as a pure derivation rather than through an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);
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
      if (!containerRef.current?.contains(event.target as Node))
        setOpenPath(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative md:hidden" ref={containerRef}>
      <button
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="border-border inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white"
        onClick={() => setOpen(!open)}
        ref={toggleRef}
        type="button"
      >
        {open ? (
          <X aria-hidden="true" size={18} />
        ) : (
          <Menu aria-hidden="true" size={18} />
        )}
      </button>
      {open && (
        <nav
          aria-label="Mobile navigation"
          className="border-border shadow-soft absolute top-13 right-0 z-50 grid min-w-56 gap-1 rounded-2xl border bg-white p-2 text-sm font-semibold"
          id="mobile-navigation"
        >
          {LINKS.map((link) => (
            <Link
              className="hover:bg-muted flex min-h-11 items-center rounded-xl px-3"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
