import Link from "next/link";
import { Heart } from "lucide-react";

import { launchCategories } from "@/config/categories";
import { metros } from "@/data/seed/marketplace";

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
  { href: "/vendors", label: "All vendors" },
  { href: "/trust-and-safety", label: "How it works" },
  { href: "/for-vendors", label: "For vendors" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  // Driven by config rather than hardcoded, so adding a category or a city
  // reaches the navbar without a code change.
  const categories = launchCategories.map((category) => ({
    description: category.description,
    name: category.name,
    slug: category.slug,
    symbol: category.symbol,
  }));
  const cities = metros.slice(0, 8).map((metro) => ({
    name: metro.name,
    slug: metro.slug,
  }));

  return (
    <HeaderChrome>
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
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
          <Link
            className="bg-brand-solid hover:bg-brand-solid-hover inline-flex h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap text-white transition sm:px-4"
            href="/for-vendors/apply"
          >
            <span className="sm:hidden">List</span>
            <span className="hidden sm:inline">List your business</span>
          </Link>
          <MobileMenu categories={categories} />
        </div>
      </div>
    </HeaderChrome>
  );
}
