import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Flag, LockKeyhole, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Trust and safety",
  description:
    "How verification works, why reviews are trustworthy, and how vendor contact details are protected.",
  alternates: { canonical: "/trust-and-safety" },
};

const PILLARS = [
  {
    icon: LockKeyhole,
    title: "Contact details are never public",
    body: "A vendor's phone number, email and WhatsApp number live in a separate table that anonymous visitors cannot read at all. They are released only after a signed-in customer submits a valid enquiry, and every release — and every later view — is recorded against the customer, the vendor and the enquiry. They are never placed in a page, a URL, or a notification email.",
  },
  {
    icon: BadgeCheck,
    title: "What “Verified” means",
    body: "We checked the business identity, confirmed the contact details are reachable, and saw evidence of relevant work. Verification lasts 12 months and can be revoked sooner. It is a check on who the business is — not a guarantee of service quality, and it is never affected by payment.",
  },
  {
    icon: Star,
    title: "Why the reviews are worth reading",
    body: "Only a customer who sent an enquiry through this marketplace can review that vendor. Reviews are moderated before publication, and we remove abusive, personal or demonstrably false content. We do not remove a review because a vendor dislikes it, and a paid plan never changes ratings or review order.",
  },
  {
    icon: Flag,
    title: "Reporting something wrong",
    body: "If a listing looks inaccurate, is not a real business, or is offensive, report it from the listing page. Reports go to a moderation queue with a named reviewer and a recorded outcome.",
  },
] as const;

export default function TrustAndSafetyPage() {
  return (
    <article>
      <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
        Policies
      </p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">Trust and safety</h1>
      <p className="mt-4 leading-7">
        A marketplace is only useful if you can believe what it tells you. This
        page explains exactly what our badges mean, and what they do not.
      </p>

      <div className="mt-8 grid gap-4">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <section
            className="border-border rounded-3xl border bg-white p-6"
            key={title}
          >
            <h2 className="!mt-0 flex items-center gap-3 text-xl font-bold">
              <Icon
                aria-hidden="true"
                className="text-brand-text shrink-0"
                size={20}
              />
              {title}
            </h2>
            <p className="text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>

      <h2>Preview listings</h2>
      <p>
        While real vendor onboarding is being built, some listings are clearly
        labelled fictional design fixtures. They carry no ratings, no reviews
        and no verification badge, they cannot be shortlisted or contacted, and
        they are excluded from search engines. If a listing does not say
        &quot;Preview&quot;, it is a real, moderated business.
      </p>

      <h2>Still concerned?</h2>
      <p>
        <Link href="/contact">Contact the moderation team</Link>. Complaints are
        acknowledged within 24 hours.
      </p>
    </article>
  );
}
