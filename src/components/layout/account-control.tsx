"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/**
 * Signed-in state in the header.
 *
 * This is deliberately a client island. Reading the session on the server would
 * mean calling `cookies()` from the root layout, which opts every route —
 * including the 60 prerendered city/category pages — into dynamic rendering.
 * Without JavaScript the "Account" link still works; `/account` redirects to
 * sign-in when there is no session.
 */
const CONFIGURED = isSupabaseConfigured();

export function AccountControl() {
  const [signedIn, setSignedIn] = useState<boolean | null>(
    CONFIGURED ? null : false,
  );

  useEffect(() => {
    if (!CONFIGURED) return;

    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setSignedIn(Boolean(session?.user));
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Link
        className="header-pill inline-flex h-11 items-center gap-2 rounded-full border bg-white px-3 text-sm font-bold transition"
        href="/account"
      >
        <UserRound aria-hidden="true" size={17} />
        <span className="hidden lg:inline">
          {signedIn ? "Account" : "Sign in"}
        </span>
        <span className="sr-only lg:hidden">
          {signedIn ? "Your account" : "Sign in"}
        </span>
      </Link>
      {signedIn && (
        <form action="/auth/sign-out" className="hidden lg:block" method="post">
          <button
            className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center px-2 text-sm font-bold"
            type="submit"
          >
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
