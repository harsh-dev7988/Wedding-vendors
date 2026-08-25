import { SectionNav } from "@/components/layout/section-nav";

const LINKS = [
  { exact: true, href: "/account", label: "My enquiries" },
  { href: "/account/notifications", label: "Alerts" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/account/reviews", label: "My reviews" },
  { href: "/account/settings", label: "Settings" },
] as const;

/**
 * Wraps every customer page in one navigation strip.
 *
 * `/shortlist` sits outside this route segment but belongs to the same mental
 * area, so it is included as a link even though it renders its own layout.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mx-auto max-w-5xl px-5 pt-8 md:px-8">
        <SectionNav label="Account sections" links={LINKS} />
      </div>
      {children}
    </div>
  );
}
