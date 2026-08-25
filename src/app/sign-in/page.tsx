import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";

import { FormAlert } from "@/components/ui/feedback";
import { isGoogleAuthEnabled, isSupabaseConfigured } from "@/lib/env";
import { safeInternalPath } from "@/lib/navigation";

import { GoogleSignInButton } from "./google-button";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const LINK_ERRORS: Record<string, string> = {
  "invalid-link":
    "That sign-in link is invalid or has expired. Request a new one below.",
  "not-configured":
    "Authentication is ready but the Supabase connection is not configured yet.",
  "google-unavailable":
    "Google sign-in is not available right now. Use the email link below instead.",
  "sign-in-cancelled":
    "Sign-in was cancelled. Nothing was shared with this site.",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  // `safeInternalPath` normalises backslashes and rejects protocol-relative
  // values. The previous `startsWith("/")` check let `//evil.example` and
  // `/\evil.example` through into the "Return to the marketplace" anchor,
  // which browsers resolve to another origin.
  const next = safeInternalPath(
    typeof params.next === "string" ? params.next : null,
  );
  const configured = isSupabaseConfigured();
  const googleEnabled = isGoogleAuthEnabled();
  const error = typeof params.error === "string" ? params.error : null;
  const linkError = error ? LINK_ERRORS[error] : null;

  return (
    <main
      className="mx-auto grid min-h-[65vh] max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-2"
      id="main-content"
    >
      <div>
        <p className="text-brand-text eyebrow">Private by design</p>
        <h1 className="type-display mt-3">Sign in before you enquire.</h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-8">
          {googleEnabled
            ? "Sign in with Google or a secure email link. Either way there is no password here to leak."
            : "Authentication uses a secure email link. It protects customer identity, reduces vendor spam, and allows every contact reveal to be audited."}
        </p>
        <ul className="mt-8 space-y-4 text-sm font-semibold">
          <li className="flex items-start gap-3">
            <LockKeyhole
              aria-hidden="true"
              className="text-success mt-0.5 shrink-0"
              size={19}
            />
            Vendor phone and email never appear in public HTML.
          </li>
          <li className="flex items-start gap-3">
            <Mail
              aria-hidden="true"
              className="text-success mt-0.5 shrink-0"
              size={19}
            />
            No password to remember or store in this application.
          </li>
        </ul>
      </div>
      <section
        aria-labelledby="sign-in-heading"
        className="border-border shadow-warm rounded-[2rem] border bg-white p-7 md:p-9"
      >
        <h2 className="type-heading" id="sign-in-heading">
          Sign in
        </h2>

        {linkError && <FormAlert className="mt-6">{linkError}</FormAlert>}

        {googleEnabled && (
          <div className="mt-6">
            <GoogleSignInButton next={next} />
            <div className="mt-6 flex items-center gap-3" role="presentation">
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                or
              </span>
              <span className="bg-border h-px flex-1" />
            </div>
          </div>
        )}

        <p className="text-muted-foreground mt-6 text-sm leading-6">
          We’ll send a single-use sign-in link that returns you to the page you
          were viewing.
        </p>

        <SignInForm configured={configured} next={next} />

        {!configured && (
          <p className="text-muted-foreground mt-4 text-xs leading-5">
            The form activates automatically when the development Supabase
            credentials are added.
          </p>
        )}
        <Link
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
          href={next}
        >
          <ArrowLeft aria-hidden="true" size={17} /> Return to the marketplace
        </Link>
      </section>
    </main>
  );
}
