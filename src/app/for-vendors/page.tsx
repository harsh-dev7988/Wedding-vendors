import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Inbox,
  Images,
  LockKeyhole,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Grow your wedding business",
  description:
    "Create a vendor workspace, publish moderated listings, and receive qualified wedding enquiries without publishing your phone number.",
  alternates: { canonical: "/for-vendors" },
};

/**
 * Present tense describes only what exists today. The previous copy advertised
 * packages, analytics, service areas and scoped team permissions — none of
 * which are built, and team invitations are not yet possible at all.
 */
const AVAILABLE_NOW = [
  {
    icon: LockKeyhole,
    title: "Your number stays private",
    text: "Phone, email and WhatsApp live in a private table with no public read access. They are released only to a signed-in customer who submits a validated enquiry.",
  },
  {
    icon: ClipboardCheck,
    title: "Moderated listings",
    text: "Create a listing per service category and city, then submit it for review. Nothing goes public until a moderator approves it.",
  },
  {
    icon: Images,
    title: "Portfolio uploads",
    text: "Upload JPEG, PNG or WebP images up to 5 MB each, with alt text. At least one image is required before a listing can be published.",
  },
  {
    icon: Inbox,
    title: "A single lead inbox",
    text: "Every enquiry arrives with the event date, guest count and requirements, and can be moved through viewed, contacted, qualified and completed.",
  },
] as const;

const ON_THE_ROADMAP = [
  "Packages and price lists on the public profile",
  "Multi-city service areas beyond the primary city",
  "Team access with owner, manager, editor and lead-manager roles",
  "Performance data: profile views, enquiry quality and response time",
  "Replying to reviews from the vendor workspace",
] as const;

export default function ForVendorsPage() {
  return (
    <main id="main-content">
      <section className="bg-foreground on-dark text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="text-accent-gold text-sm font-bold tracking-[0.16em] uppercase">
              For wedding professionals
            </p>
            <h1 className="mt-4 text-5xl leading-tight font-bold md:text-6xl">
              Turn your best work into better enquiries.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
              Publish a moderated profile, keep your contact details private,
              and receive structured enquiries from signed-in customers.
            </p>
            <Link
              className="bg-brand-solid hover:bg-brand-solid-hover mt-8 inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold transition"
              href="/for-vendors/apply"
            >
              Apply to list <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <div className="relative min-h-[28rem] overflow-hidden rounded-[2rem]">
            <Image
              alt="A wedding business team reviewing a portfolio in their studio"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 48vw, 100vw"
              src="/images/generated/vendor-studio.webp"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
          Available today
        </p>
        <h2 className="mt-3 text-4xl font-bold">
          What the vendor workspace does right now
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AVAILABLE_NOW.map(({ icon: Icon, title, text }) => (
            <article
              className="border-border shadow-soft rounded-3xl border bg-white p-6"
              key={title}
            >
              <Icon aria-hidden="true" className="text-brand-text" size={25} />
              <h3 className="mt-7 text-xl font-bold">{title}</h3>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-border bg-muted/55 border-t">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <h2 className="text-3xl font-bold">Planned, not yet built</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
            These are on the roadmap. They are listed here so you can judge the
            product on what it does today rather than what it intends to do.
          </p>
          <ul className="text-muted-foreground mt-6 grid gap-3 sm:grid-cols-2">
            {ON_THE_ROADMAP.map((item) => (
              <li className="flex items-start gap-2 leading-6" key={item}>
                <span aria-hidden="true" className="text-brand-text mt-1">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
