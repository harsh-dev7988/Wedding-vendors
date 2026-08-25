import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data Wedding Vendor collects, why, how long it is kept, and how to exercise your rights under India's DPDP Act.",
  alternates: { canonical: "/privacy" },
};

/**
 * Written against India's Digital Personal Data Protection Act, 2023. The
 * placeholders in square brackets must be completed by the operating entity
 * before launch — a published policy naming no legal entity and no grievance
 * officer does not satisfy the Act.
 */
export default function PrivacyPage() {
  return (
    <article>
      <p className="text-brand-text text-sm font-bold tracking-[0.16em] uppercase">
        Policies
      </p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">Privacy policy</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        Last updated 25 August 2026.
      </p>

      <p className="border-brand-text/25 bg-brand-soft text-brand-text mt-6 rounded-2xl border p-4 text-sm font-semibold">
        Before launch, replace every bracketed placeholder with the operating
        entity&apos;s registered details and have this reviewed by counsel. This
        page is a working draft, not legal advice.
      </p>

      <h2>Who we are</h2>
      <p>
        {siteConfig.name} is a wedding-services discovery marketplace operated
        by [LEGAL ENTITY NAME], [CIN], registered at [REGISTERED ADDRESS],
        India. We are the Data Fiduciary for the personal data described below.
      </p>

      <h2>What we collect</h2>
      <h3>If you browse without an account</h3>
      <ul>
        <li>Standard request data: IP address, user agent, pages requested.</li>
        <li>
          A session cookie only if you sign in. We do not use advertising or
          cross-site tracking cookies.
        </li>
      </ul>

      <h3>If you create an account</h3>
      <ul>
        <li>Your email address, used to sign you in and to contact you.</li>
        <li>Any name or photograph you choose to add to your profile.</li>
        <li>
          Enquiries you send: the event date, approximate guest count and the
          message you write.
        </li>
        <li>
          Shortlists, reviews you submit, and a record of each time a vendor
          contact was released to you.
        </li>
      </ul>

      <h3>If you list a business</h3>
      <ul>
        <li>Business name, registered name, and service details.</li>
        <li>
          Private contact details: phone, email and WhatsApp number. These are
          stored separately from your public profile and are never published.
        </li>
        <li>Portfolio images and any verification documents you upload.</li>
        <li>
          Payment records for subscriptions: amount, status and a payment
          reference. We never receive or store card or UPI details — those are
          handled entirely by Razorpay.
        </li>
      </ul>

      <h2>How vendor contact details are treated</h2>
      <p>
        A vendor&apos;s phone number, email address and WhatsApp number are
        never published, never included in a public page, never placed in a URL,
        and never sent in a notification email. They are released only when a
        signed-in customer submits a valid enquiry to that specific vendor, and
        every release — and every subsequent time the customer views it — is
        recorded against the customer, the vendor and the enquiry.
      </p>

      <h2>Why we process your data</h2>
      <ul>
        <li>
          To provide the service you asked for: showing listings, delivering
          your enquiry, releasing contact details.
        </li>
        <li>
          To keep the marketplace trustworthy: moderation, verification, fraud
          and spam prevention.
        </li>
        <li>To meet legal, tax and accounting obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We do not sell personal data. We share it only with processors who
        operate the service on our behalf: Supabase (database, authentication
        and file storage), Vercel (application hosting), Resend (transactional
        email) and Razorpay (payments). Each processes data only on our
        instructions.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          Account data: while your account exists, and for the period afterwards
          required by law.
        </li>
        <li>
          Enquiries and contact-release records: 24 months, after which the
          message content is erased and the record is detached from your
          identity.
        </li>
        <li>
          Payment records: as required by Indian tax and accounting law,
          currently eight years.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the DPDP Act you may:</p>
      <ul>
        <li>
          Ask what personal data we hold about you and how it is processed.
        </li>
        <li>Ask us to correct or complete inaccurate data.</li>
        <li>
          Ask us to erase your data. You can start this yourself from your
          account settings.
        </li>
        <li>
          Withdraw consent for optional processing, such as product email.
        </li>
        <li>Nominate someone to exercise these rights if you cannot.</li>
        <li>
          Raise a grievance with us, and escalate to the Data Protection Board
          of India if you are not satisfied.
        </li>
      </ul>

      <h2>Erasing your account</h2>
      <p>
        Go to <a href="/account/settings">account settings</a> and request
        deletion. We erase your profile and detach your enquiries and reviews
        from your identity. We retain the anonymised commercial record — that an
        enquiry happened, and payment records — where law requires it.
      </p>

      <h2>Children</h2>
      <p>
        This service is not intended for anyone under 18, and we do not
        knowingly collect data from children.
      </p>

      <h2>Grievance officer</h2>
      <p>
        As required by the DPDP Act and the Information Technology (Intermediary
        Guidelines) Rules:
      </p>
      <ul>
        <li>Name: [GRIEVANCE OFFICER NAME]</li>
        <li>Email: [grievance@yourdomain.example]</li>
        <li>Address: [REGISTERED ADDRESS]</li>
        <li>
          We acknowledge complaints within 24 hours and resolve them within 15
          days.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>
        If we make a material change we will tell account holders by email
        before it takes effect.
      </p>
    </article>
  );
}
