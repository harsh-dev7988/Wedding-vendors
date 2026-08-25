import Link from "next/link";
import { Heart } from "lucide-react";

import { launchCategories } from "@/config/categories";
import { metros } from "@/data/seed/marketplace";

import { AccountControl } from "./account-control";
import { CategoryMenu } from "./category-menu";
import { MobileMenu } from "./mobile-menu";
import { NotificationBell } from "./notification-bell";

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
          <CategoryMenu categories={categories} cities={cities} />
          <Link
            className="hover:text-brand-text inline-flex min-h-11 items-center transition"
            href="/vendors"
          >
            All vendors
          </Link>
          <Link
            className="hover:text-brand-text inline-flex min-h-11 items-center transition"
            href="/trust-and-safety"
          >
            How it works
          </Link>
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
          <MobileMenu categories={categories} />
        </div>
      </div>
    </header>
  );
}
