import Link from "next/link";

import { getCategories, getMetros } from "@/data/marketplace";

const POLICY_LINKS = [
  { href: "/for-vendors", label: "List your business" },
  { href: "/trust-and-safety", label: "Trust and safety" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter() {
  const metros = getMetros().slice(0, 6);
  const categories = getCategories();

  return (
    <footer className="border-border bg-foreground border-t text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-2 md:px-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Link
            className="font-display inline-flex min-h-11 items-center text-xl font-bold"
            href="/"
          >
            Wedding<span className="text-accent-gold">Vendor</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            A working name for a better way to discover, compare, and contact
            wedding professionals across India.
          </p>
          {/* Was `text-white/40` at 3.78:1 — the site-wide preview disclosure
              failed AA. `--on-dark-muted` is 11.25:1. */}
          <p className="text-on-dark-muted mt-6 max-w-sm text-xs leading-5">
            Listings labelled “Preview” are fictional design fixtures. They
            carry no ratings, reviews or verification, and cannot receive
            enquiries.
          </p>
        </div>
        <div>
          <h2 className="text-accent-gold text-sm font-bold tracking-[0.16em] uppercase">
            Categories
          </h2>
          <ul className="mt-4 space-y-1 text-sm text-white/80">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  className="inline-flex min-h-11 items-center hover:text-white"
                  href={`/vendors?category=${category.slug}`}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-accent-gold text-sm font-bold tracking-[0.16em] uppercase">
            Company
          </h2>
          <ul className="mt-4 space-y-1 text-sm text-white/80">
            {POLICY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  className="inline-flex min-h-11 items-center hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-accent-gold text-sm font-bold tracking-[0.16em] uppercase">
            Popular cities
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 text-sm text-white/80">
            {metros.map((metro) => (
              <li key={metro.slug}>
                <Link
                  className="inline-flex min-h-11 items-center hover:text-white"
                  href={`/vendors?city=${metro.slug}`}
                >
                  {metro.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
