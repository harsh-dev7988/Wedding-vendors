import type { Metadata } from "next";

import { SearchPage } from "@/components/marketplace/search-page";

export const metadata: Metadata = {
  title: "Wedding venues across India",
  description:
    "Browse banquet halls, lawns, resorts, hotels and destination wedding venues across major Indian metros.",
  // Same reasoning as /vendors: a filtered surface generates unbounded URLs.
  // The indexable landing pages are /venues/[city].
  robots: { index: false, follow: true },
  alternates: { canonical: "/venues" },
};

export default async function VenuesPage({
  searchParams,
}: PageProps<"/venues">) {
  return (
    <SearchPage
      basePath="/venues"
      description="The venue fixes your date, your guest count and much of your budget, so it is worth choosing first. Contact details stay private until a signed-in customer submits a valid enquiry."
      kind="venue"
      lockedCategory="venues"
      raw={await searchParams}
      subjectFallback="Wedding venues"
    />
  );
}
