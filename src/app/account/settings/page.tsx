import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, TriangleAlert, UserRound } from "lucide-react";

import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  DeleteAccountForm,
  NotificationForm,
  ProfileForm,
} from "./settings-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountSettingsPage() {
  const viewer = await requireViewer("/account/settings");
  const supabase = await createClient();

  const [{ data: profile }, { data: prefs }, { data: deletion }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", viewer.id)
        .maybeSingle(),
      supabase
        .from("notification_preferences")
        .select(
          "lead_emails, moderation_emails, review_request_emails, product_emails",
        )
        .eq("user_id", viewer.id)
        .maybeSingle(),
      supabase
        .from("account_deletion_requests")
        .select("requested_at")
        .eq("user_id", viewer.id)
        .maybeSingle(),
    ]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/account"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to your enquiries
      </Link>

      <p className="text-brand-text mt-6 text-sm font-bold tracking-[0.16em] uppercase">
        Account
      </p>
      <h1 className="mt-2 text-5xl font-bold">Settings</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        Signed in as {viewer.email ?? "verified customer"}
      </p>

      <section
        aria-labelledby="profile-heading"
        className="border-border mt-10 rounded-3xl border bg-white p-6 md:p-8"
      >
        <h2
          className="flex items-center gap-3 text-2xl font-bold"
          id="profile-heading"
        >
          <UserRound aria-hidden="true" className="text-brand-text" size={20} />
          Profile
        </h2>
        <ProfileForm fullName={(profile?.full_name as string | null) ?? ""} />
      </section>

      <section
        aria-labelledby="email-heading"
        className="border-border mt-6 rounded-3xl border bg-white p-6 md:p-8"
      >
        <h2
          className="flex items-center gap-3 text-2xl font-bold"
          id="email-heading"
        >
          <Mail aria-hidden="true" className="text-brand-text" size={20} />
          Email preferences
        </h2>
        <NotificationForm
          preferences={{
            leadEmails: (prefs?.lead_emails as boolean | undefined) ?? true,
            moderationEmails:
              (prefs?.moderation_emails as boolean | undefined) ?? true,
            productEmails:
              (prefs?.product_emails as boolean | undefined) ?? false,
            reviewRequestEmails:
              (prefs?.review_request_emails as boolean | undefined) ?? true,
          }}
        />
        <p className="text-muted-foreground mt-4 text-xs leading-5">
          Sign-in links and payment receipts are always sent — they are part of
          the service rather than marketing.
        </p>
      </section>

      <section
        aria-labelledby="danger-heading"
        className="border-brand-text/25 mt-6 rounded-3xl border bg-white p-6 md:p-8"
      >
        <h2
          className="flex items-center gap-3 text-2xl font-bold"
          id="danger-heading"
        >
          <TriangleAlert
            aria-hidden="true"
            className="text-brand-text"
            size={20}
          />
          Delete your account
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          You can ask us to erase your personal data at any time. See the{" "}
          <Link className="text-brand-text font-bold" href="/privacy">
            privacy policy
          </Link>{" "}
          for exactly what is erased and what we must keep.
        </p>
        <DeleteAccountForm alreadyRequested={Boolean(deletion)} />
      </section>
    </main>
  );
}
