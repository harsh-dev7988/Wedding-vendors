import type { Metadata } from "next";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectorySearchWithNearMe } from "@/components/marketplace/directory-search";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getDirectoryParams,
  getDirectorySupply,
  isIndexableDirectory,
} from "@/data/live-marketplace";
import { getCategories, getMetroBySlug, getMetros } from "@/data/marketplace";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

// Same cadence as the category pages below it, so a newly published listing
// changes the count here and the grid there at the same time.
export const revalidate = 300;
export const dynamicParams = false;

export async function generateStaticParams() {
  // See the category page: database first, seed list as the fallback.
  const live = await getDirectoryParams();
  const slugs = [...new Set(live.map((row) => row.city))];
  return slugs.length > 0
    ? slugs.map((city) => ({ city }))
    : getMetros().map((metro) => ({ city: metro.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/vendors/[city]">): Promise<Metadata> {
  const { city } = await params;
  const metro = getMetroBySlug(city);
  if (!metro) return {};

  const supply = await getDirectorySupply();
  const total = supply
    .filter((row) => row.citySlug === metro.slug)
    .reduce((sum, row) => sum + row.total, 0);

  return {
    alternates: { canonical: `/vendors/${metro.slug}` },
    description: `Browse wedding venues, photographers, caterers, makeup artists and planners in ${metro.name}. Contact details stay private until you send an enquiry.`,
    // A hub with no supply beneath it is thin content, exactly like an empty
    // category page.
    robots: isIndexableDirectory(total)
      ? undefined
      : { follow: true, index: false },
    title: `Wedding vendors in ${metro.name}`,
  };
}

export default async function CityHubPage({
  params,
}: PageProps<"/vendors/[city]">) {
  const { city } = await params;
  const metro = getMetroBySlug(city);
  if (!metro) notFound();

  const supply = await getDirectorySupply();
  const countFor = (categorySlug: string) =>
    supply.find(
      (row) => row.citySlug === metro.slug && row.categorySlug === categorySlug,
    )?.total ?? 0;

  const categories = getCategories().map((category) => ({
    ...category,
    total: countFor(category.slug),
  }));
  const total = categories.reduce((sum, category) => sum + category.total, 0);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Vendors", path: "/vendors" },
    { name: metro.name, path: `/vendors/${metro.slug}` },
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-8" id="main-content">
      <JsonLd data={breadcrumbs} />

      <nav aria-label="Breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link className="hover:text-foreground" href="/vendors">
              Vendors
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} />
          </li>
          <li aria-current="page" className="text-foreground font-semibold">
            {metro.name}
          </li>
        </ol>
      </nav>

      <h1 className="type-display mt-5 flex items-center gap-3">
        <MapPin aria-hidden="true" className="text-brand-text" size={36} />
        Wedding vendors in {metro.name}
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg leading-8">
        {total > 0
          ? `${total} published ${total === 1 ? "listing" : "listings"} across ${categories.filter((c) => c.total > 0).length} categories. `
          : "We are still onboarding businesses in this city. "}
        Vendor phone numbers and email addresses stay private until you send an
        enquiry.
      </p>

      <div className="mt-8 max-w-3xl">
        <DirectorySearchWithNearMe city={metro.slug} compact />
      </div>

      <h2 className="type-heading mt-14">Browse by category</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              className="border-border hover:border-brand-text/50 group flex h-full flex-col justify-between gap-4 rounded-3xl border bg-white p-6 transition"
              href={`/vendors/${metro.slug}/${category.slug}`}
            >
              <span>
                <span className="block text-lg font-bold">{category.name}</span>
                <span className="text-muted-foreground mt-1 block text-sm">
                  {category.total > 0
                    ? `${category.total} in ${metro.name}`
                    : `No listings in ${metro.name} yet`}
                </span>
              </span>
              <span className="text-brand-text inline-flex items-center gap-1.5 text-sm font-bold">
                Browse
                <ArrowRight
                  aria-hidden="true"
                  className="transition group-hover:translate-x-0.5"
                  size={15}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="type-heading mt-14">Other cities</h2>
      <ul className="mt-5 flex flex-wrap gap-2">
        {getMetros()
          .filter((other) => other.slug !== metro.slug)
          .map((other) => (
            <li key={other.slug}>
              <Link
                className="border-border hover:border-brand-text/50 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition"
                href={`/vendors/${other.slug}`}
              >
                {other.name}
              </Link>
            </li>
          ))}
      </ul>
    </main>
  );
}
