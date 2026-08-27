"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SectionLink = {
  readonly exact?: boolean;
  readonly href: string;
  readonly label: string;
};

/**
 * Tab strip for a signed-in area.
 *
 * Before this, every account and vendor page was reachable only by typing the
 * URL — there was no way to discover settings, alerts or billing from inside
 * the product.
 *
 * It used to scroll horizontally rather than wrap, to keep the row height
 * predictable. That traded a predictable height for invisible navigation: with
 * `scrollbar-none` there was no scrollbar, no fade and no arrow, so below about
 * 640px the last two tabs — Business settings and Billing — simply were not
 * there. Measured at a 460px strip, 80px of tabs sat past the edge with nothing
 * indicating they existed, which is indistinguishable from the pages not being
 * built. It wraps now; a taller row is a much smaller cost than a hidden one.
 */
export function SectionNav({
  label,
  links,
}: {
  readonly label: string;
  readonly links: readonly SectionLink[];
}) {
  const pathname = usePathname();

  const isActive = (link: SectionLink) =>
    link.exact ? pathname === link.href : pathname.startsWith(link.href);

  return (
    <nav aria-label={label} className="border-border border-b">
      <ul className="-mb-px flex flex-wrap gap-x-1 gap-y-0.5">
        {links.map((link) => {
          const active = isActive(link);
          return (
            <li key={link.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-bold whitespace-nowrap transition",
                  active
                    ? "border-brand-solid text-brand-text"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
