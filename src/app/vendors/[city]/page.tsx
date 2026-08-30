import type { Metadata } from "next";
import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DirectorySearchWithNearMe } from "@/components/marketplace/directory-search";
import { VendorCard } from "@/components/marketplace/vendor-card";
import { JsonLd } from "@/components/seo/json-ld";
import { RememberCity } from "@/components/location/remember-city";
import {
  getDirectoryParams,
  getDirectorySupply,
  isIndexableDirectory,
  searchLiveVendors,
} from "@/data/live-marketplace";
import { cityBanner } from "@/config/cities";
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

  const banner = cityBanner(metro.slug);

  // The page had no listings on it at all — a city hub that shows only
  // category chips asks a visitor to guess what is behind each one. Six real
  // cards answer the question the page exists to answer.
  const live = await searchLiveVendors({
    city: metro.slug,
    page: 1,
    pageSize: 6,
  });

  return (
    <main id="main-content">
      <JsonLd data={breadcrumbs} />
      <RememberCity slug={metro.slug} />

      {/* A band, because this page had no photography at all — the one page a
          city-intent search lands on, and it opened with a heading and a form.
          The image is shared across cities rather than specific to one: there
          is no per-city photography, and a stock skyline pretending to be
          Delhi would be worse than an honest wedding scene. Swap it for real
          city imagery when that exists. */}
      <section className="bg-foreground relative isolate overflow-hidden text-white">
        <Image
          alt={banner.imageAlt}
          aria-hidden={banner.imageAlt ? undefined : true}
          className="object-cover opacity-45"
          fill
          priority
          sizes="100vw"
          src={banner.image}
        />
        <div className="from-foreground/95 via-foreground/70 absolute inset-0 bg-gradient-to-r to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <nav aria-label="Breadcrumb">
            <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
              <li>
                {/* An 18px-tall link is hard to hit on a phone; the row height is
                unchanged because the sibling crumbs sit on the same line. */}
                <Link
                  className="inline-flex min-h-11 items-center hover:text-white"
                  href="/vendors"
                >
                  Vendors
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li aria-current="page" className="font-semibold text-white">
                {metro.name}
              </li>
            </ol>
          </nav>

          <p className="eyebrow text-accent-gold mt-6">Wedding vendors</p>
          <h1 className="type-page mt-3">in {metro.name}</h1>
          <p className="mt-4 max-w-2xl leading-8 text-white/80">
            {total > 0
              ? `${total} published ${total === 1 ? "listing" : "listings"} across ${categories.filter((c) => c.total > 0).length} categories. `
              : "We are still onboarding businesses in this city. "}
            Vendor phone numbers and email addresses stay private until you send
            an enquiry.
          </p>

          <div className="mt-8 max-w-3xl">
            <DirectorySearchWithNearMe city={metro.slug} compact />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pt-12 pb-14 md:px-8">
        {live.vendors.length > 0 && (
          <section aria-labelledby="available-heading" className="pb-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-brand-text eyebrow">Available now</p>
                <h2 className="type-heading mt-2" id="available-heading">
                  In {metro.name} today
                </h2>
              </div>
              {live.total > live.vendors.length && (
                <Link
                  className="link-underline text-brand-text text-sm font-bold"
                  href={`/vendors?city=${metro.slug}`}
                >
                  See all {live.total}
                </Link>
              )}
            </div>
            <div className="reveal-stagger mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {live.vendors.map((vendor, index) => (
                <VendorCard
                  key={vendor.slug}
                  priority={index < 3}
                  vendor={vendor}
                />
              ))}
            </div>
          </section>
        )}

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
              Banquet halls, lawns, resorts and hotels — start here, then book
              the rest around your date.
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
      </div>
    </main>
  );
}
