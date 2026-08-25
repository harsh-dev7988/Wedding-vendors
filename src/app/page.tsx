import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Lock, MapPin, Search, Stars } from "lucide-react";

import { launchCategories } from "@/config/categories";
import { metros } from "@/data/seed/marketplace";

/**
 * Trust statements describe how the marketplace works, not claims about
 * inventory that does not exist yet. The previous "Verified profiles / Genuine
 * reviews" badges sat directly above a catalogue of fictional fixtures.
 */
const PROMISES = [
  {
    icon: Lock,
    text: "Vendor phone and email stay private until you send an enquiry",
  },
  { icon: Stars, text: "Reviews come only from customers with a real enquiry" },
  { icon: Search, text: "Compare pricing models side by side, free to browse" },
] as const;

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="hero-glow border-border overflow-hidden border-b">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-16 pb-20 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pt-24">
          <div>
            <span className="border-brand-text/20 text-brand-text inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.16em] uppercase shadow-sm">
              <Heart aria-hidden="true" size={14} /> Foundation preview
            </span>
            <h1 className="mt-7 max-w-3xl text-5xl leading-[0.98] font-bold sm:text-6xl lg:text-7xl">
              Your wedding team,
              <span className="text-gradient block">all in one place.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
              Discover trusted venues, photographers, makeup artists, planners,
              decorators, and caterers near you.
            </p>

            <form
              action="/vendors"
              aria-labelledby="hero-search-heading"
              className="border-border shadow-warm mt-9 grid gap-2 rounded-3xl border bg-white p-2 sm:grid-cols-[1fr_1fr_auto]"
              role="search"
            >
              <h2 className="sr-only" id="hero-search-heading">
                Find wedding vendors
              </h2>
              <label className="focus-within:bg-muted flex min-h-14 items-center gap-3 rounded-2xl px-4">
                <Search
                  aria-hidden="true"
                  className="text-brand-text"
                  size={19}
                />
                <span className="sr-only">Vendor category</span>
                <select
                  className="w-full bg-transparent text-sm font-semibold"
                  defaultValue=""
                  name="category"
                >
                  <option value="">What do you need?</option>
                  {launchCategories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="border-border focus-within:bg-muted flex min-h-14 items-center gap-3 rounded-2xl border-t px-4 sm:border-t-0 sm:border-l">
                <MapPin
                  aria-hidden="true"
                  className="text-brand-text"
                  size={19}
                />
                <span className="sr-only">City</span>
                <select
                  className="w-full bg-transparent text-sm font-semibold"
                  defaultValue=""
                  name="city"
                >
                  <option value="">All launch cities</option>
                  {metros.map((metro) => (
                    <option key={metro.slug} value={metro.slug}>
                      {metro.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="bg-brand-solid hover:bg-brand-solid-hover min-h-14 rounded-2xl px-6 text-sm font-bold text-white transition"
                type="submit"
              >
                Find vendors
              </button>
            </form>

            <ul className="text-muted-foreground mt-7 grid gap-3 text-sm font-semibold">
              {PROMISES.map(({ icon: Icon, text }) => (
                <li className="flex items-start gap-2" key={text}>
                  <Icon
                    aria-hidden="true"
                    className="text-success mt-0.5 shrink-0"
                    size={17}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative hidden min-h-[30rem] lg:block">
            <div className="bg-brand shadow-warm absolute inset-8 rotate-3 overflow-hidden rounded-[3rem]">
              <Image
                alt="A newly married couple celebrating with family beneath marigold flowers"
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 44vw, 1px"
                src="/images/generated/hero-celebration.webp"
              />
              <div className="from-foreground/30 absolute inset-0 bg-gradient-to-t via-transparent to-white/5" />
            </div>
            <div className="shadow-soft absolute top-10 left-0 max-w-56 -rotate-3 rounded-3xl border border-white/70 bg-white/95 p-5 backdrop-blur">
              <p className="text-brand-text text-xs font-bold tracking-widest uppercase">
                Celebrate your way
              </p>
              <p className="font-display mt-2 text-xl font-bold">
                Find the people who bring it to life
              </p>
            </div>
            <div className="shadow-soft absolute right-0 bottom-4 max-w-64 rotate-2 rounded-3xl border border-white/70 bg-white/95 p-5 backdrop-blur">
              <p className="text-muted-foreground text-sm leading-6">
                Shortlist, compare, and contact the right professionals without
                juggling dozens of tabs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8" id="categories">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
              Launch categories
            </p>
            <h2 className="mt-3 text-4xl font-bold">
              Start with the services couples need most
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md leading-7">
            Each category has its own pricing model, filters, onboarding fields,
            and profile sections.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {launchCategories.map((category) => (
            <Link
              className="group border-border shadow-soft hover:border-brand-text/30 motion-lift overflow-hidden rounded-3xl border bg-white transition hover:-translate-y-1"
              href={`/vendors?category=${category.slug}`}
              key={category.slug}
            >
              <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                <Image
                  alt={category.imageAlt}
                  className="motion-zoom object-cover transition duration-500 group-hover:scale-[1.04]"
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                  src={category.image}
                />
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-4 rounded-full bg-white/90 p-2 text-xl shadow-sm backdrop-blur"
                >
                  {category.symbol}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold">{category.name}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {category.description}
                </p>
                <span className="text-brand-text mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Explore category{" "}
                  <ArrowRight
                    aria-hidden="true"
                    className="transition group-hover:translate-x-1"
                    size={16}
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-border bg-muted/55 border-y py-20">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 md:px-8 lg:grid-cols-[1.4fr_0.6fr]">
          <article className="group bg-foreground shadow-soft relative min-h-[30rem] overflow-hidden rounded-[2rem] text-white">
            <Image
              alt="A newly married couple sharing a candid laugh after their ceremony"
              className="motion-zoom object-cover transition duration-700 group-hover:scale-[1.025]"
              fill
              sizes="(min-width: 1024px) 65vw, 100vw"
              src="/images/generated/real-wedding-feature.webp"
            />
            <div className="from-foreground/90 via-foreground/20 absolute inset-0 bg-gradient-to-t to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 md:p-10">
              <p className="text-accent-gold text-xs font-bold tracking-[0.18em] uppercase">
                Photography &amp; film
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-bold">
                <Link
                  className="after:absolute after:inset-0 after:content-['']"
                  href="/vendors?category=photographers"
                >
                  Stories worth saving, details worth stealing.
                </Link>
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/85">
                Browse the photographers and filmmakers who document
                celebrations like these.
              </p>
            </div>
          </article>

          <article className="group bg-brand-soft shadow-soft relative min-h-[24rem] overflow-hidden rounded-[2rem] lg:min-h-full">
            <Image
              alt="Marigolds, jasmine, jewelry, and wedding stationery arranged on ivory linen"
              className="motion-zoom object-cover transition duration-700 group-hover:scale-[1.025]"
              fill
              sizes="(min-width: 1024px) 30vw, 100vw"
              src="/images/generated/inspiration-details.webp"
            />
            <div className="from-foreground/80 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white">
              <p className="text-accent-gold text-xs font-bold tracking-[0.18em] uppercase">
                Planning &amp; decor
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                <Link
                  className="after:absolute after:inset-0 after:content-['']"
                  href="/vendors?category=planners-decorators"
                >
                  Build a celebration that feels like yours.
                </Link>
              </h2>
            </div>
          </article>
        </div>
      </section>

      <section
        className="mx-auto mb-20 max-w-7xl px-5 md:px-8"
        id="vendor-onboarding"
      >
        <div className="bg-foreground on-dark mt-20 grid overflow-hidden rounded-[2rem] text-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-72 lg:min-h-[28rem]">
            <Image
              alt="A wedding business team reviewing their portfolio in a creative studio"
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src="/images/generated/vendor-studio.webp"
            />
            <div className="from-foreground/20 absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r" />
          </div>
          <div className="flex flex-col justify-center px-6 py-12 md:px-12">
            <p className="text-accent-gold text-sm font-bold tracking-[0.16em] uppercase">
              For wedding professionals
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-bold">
              A profile built to generate qualified enquiries.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/80">
              Create a business workspace, publish category-specific listings
              for moderation, and manage every enquiry in one inbox.
            </p>
            <Link
              className="bg-brand-solid hover:bg-brand-solid-hover mt-8 inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-full px-6 font-bold text-white transition"
              href="/for-vendors"
            >
              See how it works <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
