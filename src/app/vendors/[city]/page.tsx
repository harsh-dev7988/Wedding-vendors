import type { Metadata } from "next";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectorySearchWithNearMe } from "@/components/marketplace/directory-search";
import { JsonLd } from "@/components/seo/json-ld";
import { RememberCity } from "@/components/location/remember-city";
import {
  getDirectoryParams,
  getDirectorySupply,
  isIndexableDirectory,
} from "@/data/live-marketplace";
import { getCities, getCityBySlug } from "@/data/cities";
import { getServiceCategories, groupCategories } from "@/data/categories";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

// Same cadence as the category pages below it, so a newly published listing
// changes the count here and the grid there at the same time.
export const revalidate = 300;
// A city added in Supabase should work immediately rather than waiting for a
// deploy. Unknown slugs still 404 — the page checks the database and calls
// notFound(), which is what dynamicParams = false used to do for us.
export const dynamicParams = true;

export async function generateStaticParams() {
  // See the category page: database first, seed list as the fallback.
  const live = await getDirectoryParams();
  const slugs = [...new Set(live.map((row) => row.city))];
  return slugs.length > 0
    ? slugs.map((city) => ({ city }))
    : (await getCities()).map((metro) => ({ city: metro.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/vendors/[city]">): Promise<Metadata> {
  const { city } = await params;
  const metro = await getCityBySlug(city);
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
  const metro = await getCityBySlug(city);
  if (!metro) notFound();

  const supply = await getDirectorySupply();
  const countFor = (categorySlug: string) =>
    supply.find(
      (row) => row.citySlug === metro.slug && row.categorySlug === categorySlug,
    )?.total ?? 0;

  // Venues are linked separately below; a city hub that lists them beside
  // services would send people to a page that no longer exists.
  const categories = (await getServiceCategories()).map((category) => ({
    ...category,
    total: countFor(category.slug),
  }));
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  // Grouped, because eighteen equal cards give the eye nothing to hold on to.
  // Categories with supply lead their group, so the ones worth opening in this
  // city sit at the top of each section rather than in taxonomy order.
  const withCounts = groupCategories(categories).map((group) => ({
    ...group,
    categories: [...group.categories].sort((a, b) => b.total - a.total),
  }));
  const stocked = withCounts
    .map((group) => ({
      ...group,
      categories: group.categories.filter((category) => category.total > 0),
    }))
    .filter((group) => group.categories.length > 0);
  const empty = withCounts
    .map((group) => ({
      ...group,
      categories: group.categories.filter((category) => category.total === 0),
    }))
    .filter((group) => group.categories.length > 0);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Vendors", path: "/vendors" },
    { name: metro.name, path: `/vendors/${metro.slug}` },
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-8" id="main-content">
      <JsonLd data={breadcrumbs} />
      <RememberCity slug={metro.slug} />

      <nav aria-label="Breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            {/* An 18px-tall link is hard to hit on a phone; the row height is
                unchanged because the sibling crumbs sit on the same line. */}
            <Link
              className="hover:text-foreground inline-flex min-h-11 items-center"
              href="/vendors"
            >
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

      {/* Venues first and on their own, because the venue is the booking that
          constrains every other one. */}
      <Link
        className="border-brand-text/25 bg-brand-soft hover:border-brand-text/50 group mt-12 flex flex-col justify-between gap-4 rounded-3xl border p-6 transition sm:flex-row sm:items-center"
        href={`/venues/${metro.slug}`}
      >
        <span>
          <span className="text-brand-text block text-lg font-bold">
            Wedding venues in {metro.name}
          </span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Banquet halls, lawns, resorts and hotels — start here, then book the
            rest around your date.
          </span>
        </span>
        <span className="text-brand-text inline-flex shrink-0 items-center gap-1.5 text-sm font-bold">
          Browse venues
          <ArrowRight
            aria-hidden="true"
            className="transition group-hover:translate-x-0.5"
            size={15}
          />
        </span>
      </Link>

      {/* Two states, deliberately different in weight.

          A category with listings is worth a card: it is somewhere to go now.
          A category without any is worth a line: it says the directory covers
          this and invites a vendor to be the first, without eighteen identical
          empty cards making a working city look abandoned. Before the taxonomy
          grew, every category had a card and there were five of them; keeping
          that at eighteen would have been the same page with three times the
          emptiness. */}
      {stocked.length > 0 && (
        <>
          <h2 className="type-heading mt-14">Browse by category</h2>
          {stocked.map((group) => (
            <section aria-labelledby={`group-${group.slug}`} key={group.slug}>
              <h3
                className="text-brand-text eyebrow mt-8"
                id={`group-${group.slug}`}
              >
                {group.name}
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      className="border-border hover:border-brand-text/50 group flex h-full flex-col justify-between gap-4 rounded-3xl border bg-white p-6 transition"
                      href={`/vendors/${metro.slug}/${category.slug}`}
                    >
                      <span>
                        <span className="block text-lg font-bold">
                          {category.name}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-sm">
                          {category.total} in {metro.name}
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
            </section>
          ))}
        </>
      )}

      {empty.length > 0 && (
        <section aria-labelledby="awaiting-heading" className="mt-14">
          <h2 className="type-heading" id="awaiting-heading">
            {stocked.length > 0
              ? `Also covered in ${metro.name}`
              : `Categories we cover in ${metro.name}`}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
            No listings in these yet.{" "}
            <Link className="link-underline font-bold" href="/for-vendors">
              List your business
            </Link>{" "}
            to be the first.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {empty.map((group) => (
              <div key={group.slug}>
                <p className="text-muted-foreground text-[0.68rem] font-bold tracking-widest uppercase">
                  {group.name}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {group.categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        className="border-border hover:border-brand-text/50 hover:text-brand-text inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold transition"
                        href={`/vendors/${metro.slug}/${category.slug}`}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="type-heading mt-14">Other cities</h2>
      <ul className="mt-5 flex flex-wrap gap-2">
        {(await getCities())
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
