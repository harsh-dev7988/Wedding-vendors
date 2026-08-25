import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The terms that govern use of the Wedding Vendor marketplace by customers and by listed businesses.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article>
      <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
        Policies
      </p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">Terms of use</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        Last updated 25 August 2026.
      </p>

      <p className="border-brand-text/25 bg-brand-soft text-brand-text mt-6 rounded-2xl border p-4 text-sm font-semibold">
        Working draft. Replace the bracketed placeholders and have this reviewed
        by counsel before launch.
      </p>

      <h2>1. What this service is</h2>
      <p>
        {siteConfig.name} is a discovery and introduction platform operated by
        [LEGAL ENTITY NAME]. We help you find wedding businesses and send them
        an enquiry.{" "}
        <strong>
          We are not a party to any agreement you make with a vendor.
        </strong>{" "}
        We do not supply wedding services, we do not take bookings, and we do
        not hold money on your behalf.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must be 18 or older to create an account.</li>
        <li>
          Sign-in uses a single-use link sent to your email address. Keep access
          to that inbox secure.
        </li>
        <li>
          You are responsible for what happens under your account. Tell us
          promptly if you believe it has been used without your permission.
        </li>
      </ul>

      <h2>3. Enquiries and contact details</h2>
      <ul>
        <li>
          A vendor&apos;s contact details are released to you only after you
          send a genuine enquiry, and every release is recorded.
        </li>
        <li>
          Those details are provided so you can discuss your wedding. You must
          not add them to marketing lists, resell them, publish them, or use
          them for any purpose other than your own enquiry.
        </li>
        <li>
          We limit enquiries to five new vendors in 24 hours, with a cooldown on
          repeat enquiries to the same vendor.
        </li>
      </ul>

      <h2>4. Reviews</h2>
      <ul>
        <li>
          Only a customer who sent an enquiry through this platform may review
          that vendor.
        </li>
        <li>
          Reviews are moderated before publication. We remove reviews that are
          abusive, contain personal data, or are demonstrably false.
        </li>
        <li>
          We do not remove a review because a vendor dislikes it, and payment
          never affects ratings or the order in which reviews appear.
        </li>
      </ul>

      <h2>5. Terms for listed businesses</h2>
      <ul>
        <li>
          You confirm you are authorised to represent the business and that your
          details are accurate.
        </li>
        <li>
          You must hold the rights to every image you upload. You grant us a
          licence to display it on your profile and in marketplace promotion.
        </li>
        <li>
          &quot;Verified&quot; means we checked business identity, reachable
          contact details, and evidence of relevant work. It expires after 12
          months. It is not a guarantee of service quality.
        </li>
        <li>
          Listings are moderated before publication and may be suspended if this
          agreement is breached.
        </li>
        <li>
          You must respond to enquiries in good faith and must not use lead data
          for unrelated marketing.
        </li>
      </ul>

      <h2>6. Paid plans</h2>
      <ul>
        <li>
          Prices are shown in Indian rupees and include applicable taxes unless
          stated otherwise.
        </li>
        <li>
          Payments are processed by Razorpay. We never see your card details.
        </li>
        <li>
          A paid plan affects reach and tooling only. It never affects ratings,
          verification, or organic review ordering. Any sponsored placement is
          labelled.
        </li>
        <li>
          Cancel at any time; your plan runs to the end of the paid period.
          Refunds are handled per [REFUND POLICY].
        </li>
      </ul>

      <h2>7. What you must not do</h2>
      <ul>
        <li>Scrape, bulk-download or resell listings or contact details.</li>
        <li>Post false, misleading or infringing content.</li>
        <li>
          Impersonate a business, or create an account to harm a competitor.
        </li>
        <li>Attempt to bypass rate limits, moderation, or access controls.</li>
      </ul>

      <h2>8. Availability and liability</h2>
      <p>
        We work to keep the service available but do not guarantee uninterrupted
        access. To the extent permitted by law, our aggregate liability to you
        is limited to the amount you paid us in the 12 months before the claim.
        We are not liable for the acts, omissions or quality of any vendor.
      </p>

      <h2>9. Ending your use</h2>
      <p>
        You may close your account at any time from account settings. We may
        suspend an account that breaches these terms, and will explain why
        unless prevented by law.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of India, with exclusive
        jurisdiction in the courts of [CITY].
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <a href="/contact">contact us</a>.
      </p>
    </article>
  );
}
