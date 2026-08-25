import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Lock,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Stars,
} from "lucide-react";

import { SelectMenu } from "@/components/ui/select-menu";
import { launchCategories } from "@/config/categories";
import { nextImageSrcSet, nextImageUrl } from "@/lib/image-url";
import { metros } from "@/data/seed/marketplace";

const HERO_LANDSCAPE = "/images/generated/hero-full.webp";
const HERO_PORTRAIT = "/images/generated/hero-full-portrait.webp";
/**
 * Must be listed in `images.qualities` in next.config.ts, or Next silently
 * falls back to 75 — which is what was happening, re-encoding sources that had
 * been generated at 82.
 */
const HERO_QUALITY = 82;
const HERO_PORTRAIT_MEDIA = "(orientation: portrait) and (max-width: 640px)";
/** Next's default deviceSizes up to the widest a phone reports in portrait. */
const PHONE_WIDTHS = [640, 750, 828] as const;
const LANDSCAPE_WIDTHS = [1080, 1200, 1920, 2048, 3840] as const;

/**
 * Trust statements describe how the marketplace works, not claims about
 * inventory that does not exist yet. The previous "Verified profiles / Genuine
 * reviews" badges sat directly above a catalogue of fictional fixtures.
 */
const PROMISES = [
  {
    icon: Lock,
    text: "Contact details stay private until you send an enquiry",
  },
  { icon: Stars, text: "Reviews only from customers who actually enquired" },
  { icon: Search, text: "Compare pricing models side by side, free to browse" },
] as const;

const STEPS = [
  {
    body: "Filter by city, budget and pricing model. Every profile shows what a business actually charges for, not a vague banner rate.",
    icon: Search,
    title: "Search without the noise",
  },
  {
    body: "Save the businesses worth a conversation. Your shortlist follows you between devices once you sign in.",
    icon: ShieldCheck,
    title: "Shortlist the shortlist",
  },
  {
    body: "One enquiry unlocks the vendor's phone, email and WhatsApp — and starts a thread you can both keep replying in.",
    icon: MessageSquareText,
    title: "Enquire once, then talk",
  },
] as const;

export default function HomePage() {
  return (
    <main id="main-content">
      {/* ------------------------------------------------------------------
          Hero
          A full-bleed photograph rather than a boxed illustration: weddings
          are sold on atmosphere, and a card-sized image could not carry it.
          The header is translucent and sits over this section.
         ------------------------------------------------------------------ */}
      <section className="hero-full on-dark relative isolate flex items-end overflow-hidden text-white">
        {/* `priority` is deliberately absent. It emits an unconditional
            `<link rel="preload" as="image">` naming only the landscape file,
            and the preload scanner cannot see the sibling `<source>` — so a
            portrait phone preloaded the landscape hero and then fetched the
            portrait one as well. These two links say the same thing with a
            media condition, so exactly one hero is ever downloaded. */}
        <link
          as="image"
          fetchPriority="high"
          href={nextImageUrl(HERO_PORTRAIT, 828, HERO_QUALITY)}
          imageSizes="100vw"
          imageSrcSet={nextImageSrcSet(
            HERO_PORTRAIT,
            PHONE_WIDTHS,
            HERO_QUALITY,
          )}
          media={HERO_PORTRAIT_MEDIA}
          rel="preload"
        />
        <link
          as="image"
          fetchPriority="high"
          href={nextImageUrl(HERO_LANDSCAPE, 1920, HERO_QUALITY)}
          imageSizes="100vw"
          imageSrcSet={nextImageSrcSet(
            HERO_LANDSCAPE,
            LANDSCAPE_WIDTHS,
            HERO_QUALITY,
          )}
          media={`not all and ${HERO_PORTRAIT_MEDIA}`}
          rel="preload"
        />

        <div className="absolute inset-0 -z-20">
          {/* Art direction, not just resizing: a 16:9 frame centre-cropped to a
              tall phone viewport keeps a vertical sliver of the middle, which
              is the part the composition deliberately leaves empty. */}
          <picture>
            <source
              media={HERO_PORTRAIT_MEDIA}
              sizes="100vw"
              srcSet={nextImageSrcSet(
                HERO_PORTRAIT,
                PHONE_WIDTHS,
                HERO_QUALITY,
              )}
            />
            <Image
              alt="A bride and groom under a marigold canopy as their families celebrate around them"
              className="hero-drift object-cover object-center"
              fetchPriority="high"
              fill
              loading="eager"
              quality={HERO_QUALITY}
              sizes="100vw"
              src={HERO_LANDSCAPE}
            />
          </picture>
        </div>
        <div aria-hidden="true" className="hero-scrim absolute inset-0 -z-10" />

        <div className="mx-auto w-full max-w-7xl px-5 pt-28 pb-14 md:px-8 md:pb-20">
          <p className="eyebrow text-accent-gold">
            Wedding vendors · 8 Indian metros
          </p>

          <h1 className="type-display mt-5 max-w-4xl">
            The people who make the day{" "}
            <span className="type-accent text-accent-gold">unforgettable.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/85">
            Venues, photographers, makeup artists, planners and caterers —
            compared honestly, contacted privately, all in one place.
          </p>

          {/* On its own white card: white-on-photograph is fine for display
              type with a scrim behind it, but form controls need a stable,
              opaque surface to stay legible and hit contrast on their borders. */}
          <form
            action="/vendors"
            aria-labelledby="hero-search-heading"
            className="shadow-warm mt-10 grid max-w-3xl gap-2 rounded-[1.75rem] border border-white/60 bg-white/95 p-2 backdrop-blur-md sm:grid-cols-[1fr_1fr_auto]"
            role="search"
          >
            <h2 className="sr-only" id="hero-search-heading">
              Find wedding vendors
            </h2>
            <div className="focus-within:bg-muted flex min-h-14 items-center gap-3 rounded-[1.25rem] px-4 transition">
              <Search
                aria-hidden="true"
                className="text-brand-text"
                size={19}
              />
              <SelectMenu
                className="text-foreground text-sm font-semibold"
                label="Vendor category"
                name="category"
                options={[
                  { label: "Any category", value: "" },
                  ...launchCategories.map((category) => ({
                    label: category.name,
                    value: category.slug,
                  })),
                ]}
                placeholder="What do you need?"
              />
            </div>
            <div className="border-border focus-within:bg-muted flex min-h-14 items-center gap-3 rounded-[1.25rem] border-t px-4 transition sm:border-t-0 sm:border-l">
              <MapPin
                aria-hidden="true"
                className="text-brand-text"
                size={19}
              />
              <SelectMenu
                className="text-foreground text-sm font-semibold"
                label="City"
                name="city"
                options={[
                  { label: "All launch cities", value: "" },
                  ...metros.map((metro) => ({
                    label: metro.name,
                    value: metro.slug,
                  })),
                ]}
                placeholder="All launch cities"
              />
            </div>
            <button
              className="bg-brand-solid hover:bg-brand-solid-hover motion-lift min-h-14 rounded-[1.25rem] px-7 text-sm font-bold text-white"
              type="submit"
            >
              Find vendors
            </button>
          </form>

          <ul className="mt-9 grid gap-x-8 gap-y-3 text-sm font-semibold text-white/85 sm:grid-cols-3">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li className="flex items-start gap-2.5" key={text}>
                <Icon
                  aria-hidden="true"
                  className="text-accent-gold mt-0.5 shrink-0"
                  size={17}
                />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          How it works
         ------------------------------------------------------------------ */}
      <section
        aria-labelledby="how-it-works-heading"
        className="border-border bg-muted/45 border-b"
      >
        <div className="reveal mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <p className="eyebrow text-brand-text">How it works</p>
          <h2 className="type-title mt-4 max-w-2xl" id="how-it-works-heading">
            Three steps, and nobody gets your number until you say so.
          </h2>

          <ol className="reveal-stagger mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map(({ body, icon: Icon, title }, index) => (
              <li className="relative" key={title}>
                <span
                  aria-hidden="true"
                  className="font-display text-brand-soft block text-6xl leading-none font-semibold"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="type-heading mt-2 flex items-center gap-2.5">
                  <Icon
                    aria-hidden="true"
                    className="text-brand-text shrink-0"
                    size={20}
                  />
                  {title}
                </h3>
                <p className="text-muted-foreground mt-3 leading-7">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Categories
         ------------------------------------------------------------------ */}
      <section
        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24"
        id="categories"
      >
        <div className="reveal flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow text-brand-text">Launch categories</p>
            <h2 className="type-title mt-4 max-w-xl">
              Start with what couples book{" "}
              <span className="type-accent">first.</span>
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md leading-7">
            Each category has its own pricing model, filters and profile
            sections — because a caterer and a photographer are not the same
            purchase.
          </p>
        </div>

        <div className="reveal-stagger mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {launchCategories.map((category, index) => (
            <Link
              className={`group border-border shadow-soft hover:border-brand-text/30 motion-lift relative overflow-hidden rounded-[1.75rem] border bg-white ${
                // The first tile runs full width on large screens, which turns
                // an even grid into an editorial one.
                index === 0 ? "lg:col-span-2" : ""
              }`}
              href={`/vendors?category=${category.slug}`}
              key={category.slug}
            >
              <div
                className={`bg-muted relative overflow-hidden ${
                  index === 0 ? "aspect-[16/9]" : "aspect-[4/3]"
                }`}
              >
                <Image
                  alt={category.imageAlt}
                  className="motion-zoom object-cover"
                  fill
                  sizes={
                    index === 0
                      ? "(min-width: 1024px) 62vw, (min-width: 640px) 50vw, 100vw"
                      : "(min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"
                  }
                  src={category.image}
                />
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-4 rounded-full bg-white/90 p-2 text-xl shadow-sm backdrop-blur"
                >
                  {category.symbol}
                </span>
              </div>
              <div className="p-6">
                <h3 className="type-heading">{category.name}</h3>
                <p className="text-muted-foreground mt-2 leading-7">
                  {category.description}
                </p>
                <span className="text-brand-text mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Explore category
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

      {/* ------------------------------------------------------------------
          Editorial pair
         ------------------------------------------------------------------ */}
      <section className="border-border bg-muted/55 border-y py-20 md:py-24">
        <div className="reveal mx-auto grid max-w-7xl gap-5 px-5 md:px-8 lg:grid-cols-[1.4fr_0.6fr]">
          <article className="group bg-foreground shadow-soft relative min-h-[26rem] overflow-hidden rounded-[2rem] text-white md:min-h-[32rem]">
            <Image
              alt="A newly married couple sharing a candid laugh after their ceremony"
              className="motion-zoom object-cover"
              fill
              sizes="(min-width: 1024px) 65vw, 100vw"
              src="/images/generated/real-wedding-feature.webp"
            />
            <div className="from-foreground/92 via-foreground/25 absolute inset-0 bg-gradient-to-t to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 md:p-10">
              <p className="eyebrow text-accent-gold">Photography &amp; film</p>
              <h2 className="type-title mt-3 max-w-xl">
                <Link
                  className="link-underline after:absolute after:inset-0 after:content-['']"
                  href="/vendors?category=photographers"
                >
                  Stories worth saving.
                </Link>
              </h2>
              <p className="mt-3 max-w-lg leading-7 text-white/85">
                Browse the photographers and filmmakers who document
                celebrations like these — with real starting prices, not
                “enquire for pricing”.
              </p>
            </div>
          </article>

          <article className="group bg-brand-soft shadow-soft relative min-h-[22rem] overflow-hidden rounded-[2rem] lg:min-h-full">
            <Image
              alt="Marigolds, jasmine, jewellery and wedding stationery arranged on ivory linen"
              className="motion-zoom object-cover"
              fill
              sizes="(min-width: 1024px) 30vw, 100vw"
              src="/images/generated/inspiration-details.webp"
            />
            <div className="from-foreground/85 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white">
              <p className="eyebrow text-accent-gold">Planning &amp; decor</p>
              <h2 className="type-heading mt-2">
                <Link
                  className="link-underline after:absolute after:inset-0 after:content-['']"
                  href="/vendors?category=planners-decorators"
                >
                  A celebration that feels like yours.
                </Link>
              </h2>
            </div>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Cities
         ------------------------------------------------------------------ */}
      <section
        aria-labelledby="cities-heading"
        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24"
      >
        <div className="reveal">
          <p className="eyebrow text-brand-text">Where we have launched</p>
          <h2 className="type-title mt-4 max-w-2xl" id="cities-heading">
            Eight metros, and the neighbourhoods inside them.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
            Search by pincode to find businesses that actually serve your venue,
            rather than everyone who lists the city.
          </p>
        </div>

        <ul className="reveal-stagger mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metros.map((metro) => (
            <li key={metro.slug}>
              <Link
                className="group border-border hover:border-brand-text/40 motion-lift flex min-h-16 items-center justify-between gap-3 rounded-2xl border bg-white px-5"
                href={`/vendors/${metro.slug}`}
              >
                <span className="font-display text-lg font-semibold">
                  {metro.name}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-brand-text shrink-0 transition group-hover:translate-x-1"
                  size={17}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------
          Vendor CTA
         ------------------------------------------------------------------ */}
      <section
        className="mx-auto mb-24 max-w-7xl px-5 md:px-8"
        id="vendor-onboarding"
      >
        <div className="bg-foreground on-dark reveal grid overflow-hidden rounded-[2rem] text-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-72 lg:min-h-[30rem]">
            <Image
              alt="A wedding business team reviewing their portfolio in a creative studio"
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src="/images/generated/vendor-studio.webp"
            />
            <div className="from-foreground/30 absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r" />
          </div>
          <div className="flex flex-col justify-center px-6 py-14 md:px-12">
            <p className="eyebrow text-accent-gold">
              For wedding professionals
            </p>
            <h2 className="type-title mt-4 max-w-2xl">
              A profile built to generate{" "}
              <span className="type-accent text-accent-gold">qualified</span>{" "}
              enquiries.
            </h2>
            <p className="mt-5 max-w-2xl leading-7 text-white/80">
              Create a business workspace, publish category-specific listings
              for moderation, and manage every enquiry in one inbox. Your phone
              number is never scraped off a public page.
            </p>
            <Link
              className="bg-brand-solid hover:bg-brand-solid-hover motion-lift mt-9 inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-full px-7 font-bold text-white"
              href="/for-vendors"
            >
              List your business <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
