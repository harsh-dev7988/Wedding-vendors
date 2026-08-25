import type { Metadata } from "next";
import { AtSign, Clock, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact and grievances",
  description:
    "How to reach the Wedding Vendor team, and the grievance officer details required under Indian law.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article>
      <p className="text-brand-text eyebrow">Support</p>
      <h1 className="type-title mt-2 md:text-5xl">Contact us</h1>

      <p className="border-brand-text/25 bg-brand-soft text-brand-text mt-6 rounded-2xl border p-4 text-sm font-semibold">
        Replace the bracketed placeholders with real, monitored addresses before
        launch. Publishing grievance officer details is a legal requirement in
        India, and the address must actually be answered.
      </p>

      <h2>General support</h2>
      <p>
        <AtSign aria-hidden="true" className="mr-2 inline" size={16} />
        [support@yourdomain.example] — for questions about your account, an
        enquiry, or a listing.
      </p>

      <h2>Vendors</h2>
      <p>
        <AtSign aria-hidden="true" className="mr-2 inline" size={16} />
        [vendors@yourdomain.example] — for verification, moderation decisions
        and billing.
      </p>

      <h2>Grievance officer</h2>
      <p>
        Required under the Digital Personal Data Protection Act, 2023 and the
        Information Technology (Intermediary Guidelines and Digital Media Ethics
        Code) Rules, 2021.
      </p>
      <ul>
        <li>Name: [GRIEVANCE OFFICER NAME]</li>
        <li>Designation: Grievance Officer</li>
        <li>Email: [grievance@yourdomain.example]</li>
        <li>Address: [REGISTERED ADDRESS], India</li>
      </ul>
      <p>
        <Clock aria-hidden="true" className="mr-2 inline" size={16} />
        Complaints are acknowledged within 24 hours and resolved within 15 days.
        If you are not satisfied, you may escalate to the Data Protection Board
        of India.
      </p>

      <h2>Reporting a listing</h2>
      <p>
        <ShieldAlert aria-hidden="true" className="mr-2 inline" size={16} />
        Use the report link on the listing itself so the report is attached to
        the right record. Urgent safety concerns should also be emailed to the
        grievance officer above.
      </p>

      <h2>Registered entity</h2>
      <p>
        [LEGAL ENTITY NAME], [CIN], [REGISTERED ADDRESS], India. GSTIN: [GSTIN].
      </p>
    </article>
  );
}
