import { SectionNav } from "@/components/layout/section-nav";

const LINKS = [
  { exact: true, href: "/admin", label: "Needs attention" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/vendors", label: "Businesses" },
  { href: "/admin/reports", label: "Abuse reports" },
  { href: "/admin/audit-log", label: "Audit log" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-8">
        <SectionNav label="Operations sections" links={LINKS} />
      </div>
      {children}
    </div>
  );
}
