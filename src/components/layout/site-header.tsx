import Link from "next/link";
import { Heart } from "lucide-react";

import { AccountControl } from "./account-control";
import { MobileMenu } from "./mobile-menu";
import { NotificationBell } from "./notification-bell";

const PRIMARY_LINKS = [
  { href: "/vendors", label: "Explore vendors" },
  { href: "/vendors?category=venues", label: "Venues" },
  { href: "/vendors?category=photographers", label: "Photographers" },
  { href: "/vendors?category=makeup-artists", label: "Makeup" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border/80 bg-background/90 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
        {/* `min-w-0` + `truncate`: at 320px the CTA pill wrapped to two lines
            and overlapped the wordmark. */}
        <Link
          className="font-display flex min-h-11 min-w-0 shrink items-center truncate text-lg font-bold tracking-tight sm:text-xl"
          href="/"
        >
          Wedding<span className="text-brand-text">Vendor</span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 text-sm font-semibold md:flex"
        >
          {PRIMARY_LINKS.map((link) => (
            <Link
              className="hover:text-brand-text inline-flex min-h-11 items-center transition"
              href={link.href}
              key={link.label}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            aria-label="View shortlist"
            className="border-border hover:border-brand-text/40 hidden h-11 w-11 items-center justify-center rounded-full border bg-white transition sm:inline-flex"
            href="/shortlist"
          >
            <Heart aria-hidden="true" size={18} />
          </Link>
          <NotificationBell />
          <AccountControl />
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover inline-flex h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap text-white transition sm:px-4"
            href="/for-vendors"
          >
            <span className="sm:hidden">List</span>
            <span className="hidden sm:inline">List your business</span>
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
