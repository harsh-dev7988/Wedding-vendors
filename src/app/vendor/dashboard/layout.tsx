import { SectionNav } from "@/components/layout/section-nav";

const LINKS = [
  { exact: true, href: "/vendor/dashboard", label: "Overview" },
  { href: "/vendor/dashboard/listings", label: "Listings" },
  { href: "/vendor/dashboard/leads", label: "Leads" },
  { href: "/vendor/dashboard/reviews", label: "Reviews" },
  { href: "/vendor/dashboard/settings", label: "Business settings" },
  { href: "/vendor/dashboard/billing", label: "Billing" },
] as const;

export default function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-8">
        <SectionNav label="Vendor workspace sections" links={LINKS} />
      </div>
      {children}
    </div>
  );
}
