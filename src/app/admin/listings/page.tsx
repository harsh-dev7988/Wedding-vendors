import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
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
  title: "All listings",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

const STATUSES = [
  { label: "Needs review", value: "pending_review" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Rejected", value: "rejected" },
  { label: "Suspended", value: "suspended" },
  { label: "All", value: "" },
] as const;

type Row = {
  created_at: string;
  id: string;
  slug: string;
  status: string;
  title: string;
  vendors: { business_name: string; status: string } | null;
};

export default async function AdminListingsPage({
  searchParams,
}: PageProps<"/admin/listings">) {
  await requireViewer("/admin/listings");
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
    .from("listings")
    .select(
      "id, title, slug, status, created_at, vendors(business_name, status)",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) request = request.eq("status", status);
  if (query) request = request.ilike("title", `%${escapeLikePattern(query)}%`);

  const { count, data } = await request;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Operations</p>
      <h1 className="type-display mt-2 flex items-center gap-3">
        <ClipboardList
          aria-hidden="true"
          className="text-brand-text"
          size={34}
        />
        All listings
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Every listing in the marketplace, not only the ones waiting for a
        decision. Open one to see the full submission and moderate it.
      </p>

      <ListControls
        basePath="/admin/listings"
        placeholder="Search listing titles"
        query={query}
        status={status}
        statuses={STATUSES}
      />

      {rows.length === 0 ? (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-8 text-sm">
          {query
            ? `No listings match “${query}”.`
            : "No listings with this status."}
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                className="border-border hover:border-brand-text/50 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5 transition"
                href={`/admin/listings/${row.id}`}
              >
                <span>
                  <span className="block font-bold">{row.title}</span>
                  <span className="text-muted-foreground block text-sm">
                    {row.vendors?.business_name ?? "Business removed"} ·{" "}
                    {formatIndiaDateTime(row.created_at)}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/admin/listings"
        extraParams={{ q: query, status }}
        noun="listings"
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </main>
  );
}
