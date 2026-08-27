import Link from "next/link";
import { Heart } from "lucide-react";

import { getServiceCategories } from "@/data/marketplace";
import { getCities } from "@/data/cities";

import { AccountControl } from "./account-control";
import { CategoryMenu } from "./category-menu";
import { HeaderChrome } from "./header-chrome";
import { MobileMenu } from "./mobile-menu";
import { NotificationBell } from "./notification-bell";

/**
 * Every destination a visitor is expected to reach from any page. The dropdown
 * carries categories and cities; these are the standalone ones.
 */
const PRIMARY_LINKS = [
  // Venues sit beside the vendor directory rather than inside it. You book one
  // venue and it fixes the date, the guest count and much of the budget;
  // everything else is chosen around it, so it is not one category among six.
  { href: "/venues", label: "Venues" },
  { href: "/vendors", label: "All vendors" },
  { href: "/for-vendors", label: "For vendors" },
  { href: "/contact", label: "Contact" },
] as const;

export async function SiteHeader() {
  // Driven by config rather than hardcoded, so adding a category or a city
  // reaches the navbar without a code change.
  // Services only — venues have their own top-level link above.
  const categories = getServiceCategories().map((category) => ({
    description: category.description,
    name: category.name,
    slug: category.slug,
    symbol: category.symbol,
  }));
  // Eight fit the dropdown; the rest are reachable from /vendors.
  const cities = (await getCities()).slice(0, 8).map((city) => ({
    name: city.name,
    slug: city.slug,
  }));

  return (
    <HeaderChrome>
      <div className="flex h-18 w-full items-center justify-between gap-3 px-4 md:px-6">
        {/* `min-w-0` + `truncate`: at 320px the CTA pill wrapped to two lines
            and overlapped the wordmark. */}
        <Link
          className="font-display flex min-h-11 min-w-0 shrink items-center truncate text-xl font-semibold tracking-tight sm:text-2xl"
          href="/"
        >
          Wedding<span className="header-accent text-brand-text">Vendor</span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-5 text-sm font-semibold lg:flex"
        >
          <CategoryMenu categories={categories} cities={cities} />
          {PRIMARY_LINKS.map((link) => (
            <Link
              className="header-link inline-flex min-h-11 items-center transition"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            aria-label="View shortlist"
            className="header-pill hidden h-11 w-11 items-center justify-center rounded-full border bg-white transition sm:inline-flex"
            href="/shortlist"
          >
            <Heart aria-hidden="true" size={18} />
          </Link>
          <NotificationBell />
          <AccountControl />
          {/* The call to action is rendered by AccountControl, which knows
              whether the viewer is already a vendor. */}
          <MobileMenu categories={categories} />
        </div>
      </div>
    </HeaderChrome>
  );
}
