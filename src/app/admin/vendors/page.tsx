import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

import { ListControls, escapeLikePattern } from "../list-controls";
import { StatusPill } from "../status-pill";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "All businesses",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

const STATUSES = [
  { label: "Needs review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Suspended", value: "suspended" },
  { label: "All", value: "" },
] as const;

type Row = {
  business_name: string;
  created_at: string;
  id: string;
  status: string;
  verification_expires_at: string | null;
};

export default async function AdminVendorsPage({
  searchParams,
}: PageProps<"/admin/vendors">) {
  await requireViewer("/admin/vendors");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const params = await searchParams;
  const rawStatus =
    typeof params.status === "string" ? params.status : "pending_review";
  const status = STATUSES.some((item) => item.value === rawStatus)
    ? rawStatus
    : "pending_review";
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const page = parsePage(params.page);
  const from = (page - 1) * PAGE_SIZE;

  let request = supabase
    .from("vendors")
    .select("id, business_name, status, verification_expires_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) request = request.eq("status", status);
  if (query)
    request = request.ilike("business_name", `%${escapeLikePattern(query)}%`);

  // Expiry is evaluated in the database, not from Date.now(): the render has
  // to stay pure, and this is the same boundary the public "Verified" badge
  // uses, so the two can never disagree.
  const [{ count, data }, { data: expiredData }] = await Promise.all([
    request,
    supabase.rpc("list_expired_verifications"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const expiredIds = new Set(
    ((expiredData ?? []) as Array<{ vendor_id: string }>).map(
      (row) => row.vendor_id,
    ),
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Operations</p>
      <h1 className="type-page mt-2 flex items-center gap-3">
        <ShieldCheck aria-hidden="true" className="text-brand-text" size={34} />
        All businesses
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Verification lapses after twelve months and the badge disappears on its
        own, without unpublishing a working business. Expired entries are
        flagged here so they can be chased.
      </p>

      <ListControls
        basePath="/admin/vendors"
        placeholder="Search business names"
        query={query}
        status={status}
        statuses={STATUSES}
      />

      {rows.length === 0 ? (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-8 text-sm">
          {query
            ? `No businesses match “${query}”.`
            : "No businesses with this status."}
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((row) => {
            const expired = expiredIds.has(row.id);

            return (
              <li key={row.id}>
                <Link
                  className="border-border hover:border-brand-text/50 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5 transition"
                  href={`/admin/vendors/${row.id}`}
                >
                  <span>
                    <span className="block font-bold">{row.business_name}</span>
                    <span className="text-muted-foreground block text-sm">
                      Joined {formatIndiaDateTime(row.created_at)}
                      {row.verification_expires_at &&
                        ` · verification ${expired ? "expired" : "valid until"} ${formatIndiaDateTime(row.verification_expires_at)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {expired && (
                      <span className="bg-brand-soft text-brand-text rounded-full px-2.5 py-1 text-xs font-bold">
                        re-verify
                      </span>
                    )}
                    <StatusPill status={row.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        basePath="/admin/vendors"
        extraParams={{ q: query, status }}
        noun="businesses"
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </main>
  );
}
