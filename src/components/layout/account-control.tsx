"use client";

import {
  ChevronDown,
  Flag,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/**
 * Signed-in state and role-aware navigation.
 *
 * This is deliberately a client island. Reading the session — or roles — on the
 * server would mean calling `cookies()` from the root layout, which opts every
 * route into dynamic rendering, including the 83 prerendered pages. That
 * regression has already happened twice in this codebase.
 *
 * Roles matter because the header used to be identical for everyone. An
 * approved vendor had no route to their dashboard above 768px, an admin had no
 * route to moderation at all, and the only prominent button sent both back to
 * the vendor application form — which produced a duplicate business rather than
 * the listing the vendor wanted.
 *
 * Without JavaScript the "Account" link still works and `/account` redirects to
 * sign-in when there is no session.
 */
const CONFIGURED = isSupabaseConfigured();

type Roles = { isAdmin: boolean; isVendor: boolean };

type Item = {
  readonly href: string;
  readonly icon: typeof UserRound;
  readonly label: string;
};

const CUSTOMER: readonly Item[] = [
  { href: "/account", icon: MessageSquareText, label: "My enquiries" },
  { href: "/shortlist", icon: Heart, label: "Shortlist" },
  { href: "/account/reviews", icon: Star, label: "My reviews" },
  { href: "/account/settings", icon: Settings, label: "Settings" },
];

const VENDOR: readonly Item[] = [
  {
    href: "/vendor/dashboard",
    icon: LayoutDashboard,
    label: "Vendor dashboard",
  },
  {
    href: "/vendor/dashboard/listings",
    icon: LayoutDashboard,
    label: "My listings",
  },
  { href: "/vendor/dashboard/leads", icon: MessageSquareText, label: "Leads" },
];

const ADMIN: readonly Item[] = [
  { href: "/admin", icon: ShieldCheck, label: "Moderation queue" },
  { href: "/admin/reports", icon: Flag, label: "Abuse reports" },
];

export function AccountControl() {
  const [signedIn, setSignedIn] = useState<boolean | null>(
    CONFIGURED ? null : false,
  );
  const [roles, setRoles] = useState<Roles>({
    isAdmin: false,
    isVendor: false,
  });
  // Keyed on the pathname so a navigation closes the menu without an effect.
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!CONFIGURED) return;

    const supabase = createClient();
    let active = true;

    const load = async (hasUser: boolean) => {
      if (!active) return;
      setSignedIn(hasUser);
      if (!hasUser) {
        setRoles({ isAdmin: false, isVendor: false });
        return;
      }
      // `admin_roles` has no grants at all, so admin status can only come from
      // the security-definer RPC. Memberships are readable by their owner.
      const [membership, admin] = await Promise.all([
        supabase.from("vendor_members").select("vendor_id").limit(1),
        supabase.rpc("is_admin"),
      ]);
      if (!active) return;
      setRoles({
        isAdmin: admin.data === true,
        isVendor: (membership.data?.length ?? 0) > 0,
      });
    };

    supabase.auth.getUser().then(({ data }) => void load(Boolean(data.user)));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => void load(Boolean(session?.user)),
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenPath(null);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenPath(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  /**
   * The call to action lives here rather than in the header because it depends
   * on the same role check. Telling an approved vendor to "List your business"
   * sent them back to the application form, where they registered a *second
   * business* instead of adding a listing — a navigation mistake that wrote bad
   * data rather than merely confusing people.
   */
  const cta = roles.isVendor ? (
    <Link
      className="bg-brand-solid hover:bg-brand-solid-hover inline-flex h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap text-white transition sm:px-4"
      href="/vendor/dashboard/listings"
    >
      <span className="sm:hidden">Add</span>
      <span className="hidden sm:inline">Add a listing</span>
    </Link>
  ) : (
    <Link
      className="bg-brand-solid hover:bg-brand-solid-hover inline-flex h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap text-white transition sm:px-4"
      href="/for-vendors/apply"
    >
      <span className="sm:hidden">List</span>
      <span className="hidden sm:inline">List your business</span>
    </Link>
  );

  // Signed out, or not yet known: a plain link, which is also the no-JS state.
  if (!signedIn) {
    return (
      <>
        <Link
          className="header-pill inline-flex h-11 items-center gap-2 rounded-full border bg-white px-3 text-sm font-bold transition"
          href="/account"
        >
          <UserRound aria-hidden="true" size={17} />
          <span className="hidden lg:inline">Sign in</span>
          <span className="sr-only lg:hidden">Sign in</span>
        </Link>
        {cta}
      </>
    );
  }

  const groups = [
    { items: CUSTOMER, label: "Your account" },
    ...(roles.isVendor ? [{ items: VENDOR, label: "Your business" }] : []),
    ...(roles.isAdmin ? [{ items: ADMIN, label: "Operations" }] : []),
  ];

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="header-pill inline-flex h-11 items-center gap-2 rounded-full border bg-white px-3 text-sm font-bold transition"
          onClick={() => setOpenPath(open ? null : pathname)}
          ref={toggleRef}
          type="button"
        >
          <UserRound aria-hidden="true" size={17} />
          <span className="hidden lg:inline">Account</span>
          <span className="sr-only lg:hidden">Your account</span>
          <ChevronDown
            aria-hidden="true"
            className={`transition ${open ? "rotate-180" : ""}`}
            size={14}
          />
        </button>

        {open && (
          <div
            className="border-border shadow-soft text-foreground absolute top-13 right-0 z-[110] min-w-60 rounded-2xl border bg-white p-2"
            role="menu"
          >
            {groups.map((group, index) => (
              <div
                className={index > 0 ? "border-border mt-2 border-t pt-2" : ""}
                key={group.label}
              >
                <p className="text-muted-foreground px-3 pt-1 pb-1.5 text-[0.68rem] font-bold tracking-widest uppercase">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Link
                    className="hover:bg-muted flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition"
                    href={item.href}
                    key={item.href}
                    role="menuitem"
                  >
                    <item.icon
                      aria-hidden="true"
                      className="text-brand-text shrink-0"
                      size={16}
                    />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <form
              action="/auth/sign-out"
              className="border-border mt-2 border-t pt-2"
              method="post"
            >
              <button
                className="hover:bg-muted flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition"
                role="menuitem"
                type="submit"
              >
                <LogOut aria-hidden="true" className="shrink-0" size={16} />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
      {cta}
    </>
  );
}
