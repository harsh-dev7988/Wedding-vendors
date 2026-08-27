import type { Metadata } from "next";

import { SearchPage } from "@/components/marketplace/search-page";

export const metadata: Metadata = {
  title: "Wedding vendors across India",
  description:
    "Browse wedding photographers, makeup artists, planners, decorators, and caterers across major Indian metros.",
  // A free-text search surface generates unbounded URLs. The indexable
  // landing pages are /vendors/[city]/[category].
  robots: { index: false, follow: true },
  alternates: { canonical: "/vendors" },
};

export default async function VendorsPage({
  searchParams,
}: PageProps<"/vendors">) {
  // `?category=venues` is redirected in `proxy.ts`, which is the only place it
  // can be a real HTTP redirect: this route has a `loading.tsx`, and a loading
  // boundary streams a 200 shell before the page runs. `SearchPage` still
  // ignores a category of the wrong kind, so a request that somehow reaches
  // here shows services rather than silently mixing the two.
  return (
    <SearchPage
      basePath="/vendors"
      description="Browse category-aware profiles and starting prices. Contact details stay private until a signed-in customer submits a valid enquiry."
      kind="service"
      raw={await searchParams}
      subjectFallback="Wedding vendors"
    />
  );
}
