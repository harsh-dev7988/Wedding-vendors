"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

const CONFIGURED = isSupabaseConfigured();

/**
 * Unread count in the header.
 *
 * A client island for the same reason as the account control: reading this on
 * the server would mean `cookies()` in the root layout, which would opt all 71
 * prerendered public pages into dynamic rendering.
 *
 * It refetches on navigation rather than subscribing to Realtime. Supabase
 * warns that complex RLS on `postgres_changes` raises connection latency, and
 * our policies are nested `exists` checks. A push channel can be added later
 * with Broadcast if usage shows people sit on a page waiting.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!CONFIGURED) return;
    let active = true;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setSignedIn(false);
        setUnread(0);
        return;
      }
      setSignedIn(true);

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      if (active) setUnread(count ?? 0);
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  if (!signedIn) return null;

  return (
    <Link
      className="border-border hover:border-brand-text/40 relative inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white transition"
      href="/account/notifications"
    >
      <Bell aria-hidden="true" size={18} />
      {unread > 0 && (
        <span className="bg-brand-solid absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      <span className="sr-only">
        Notifications
        {unread > 0 ? `, ${unread} unread` : ", none unread"}
      </span>
    </Link>
  );
}
