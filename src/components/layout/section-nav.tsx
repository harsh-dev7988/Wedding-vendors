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
 * the product. It scrolls horizontally on narrow screens rather than wrapping,
 * so the row height stays predictable.
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
      <ul className="-mb-px flex scrollbar-none gap-1 overflow-x-auto">
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
