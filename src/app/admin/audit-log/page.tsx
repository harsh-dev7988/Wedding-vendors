import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  { label: "All", value: "" },
  { label: "Vendors", value: "vendor" },
  { label: "Listings", value: "listing" },
  { label: "Reviews", value: "review" },
  { label: "Reports", value: "report" },
] as const;

type Row = {
  action: string;
  actor_id: string | null;
  created_at: string;
  detail: Record<string, unknown>;
  entity_id: string | null;
  entity_type: string;
  id: string;
};

/** Where an entity can be opened, when the admin area has a page for it. */
const ENTITY_HREF: Record<string, (id: string) => string> = {
  listing: (id) => `/admin/listings/${id}`,
  vendor: (id) => `/admin/vendors/${id}`,
};

export default async function AdminAuditLogPage({
  searchParams,
}: PageProps<"/admin/audit-log">) {
  await requireViewer("/admin/audit-log");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const params = await searchParams;
  const rawType = typeof params.type === "string" ? params.type : "";
  const entityType = ENTITY_TYPES.some((item) => item.value === rawType)
    ? rawType
    : "";
  const page = parsePage(params.page);
  const from = (page - 1) * PAGE_SIZE;

  let request = supabase
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, detail, created_at",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (entityType) request = request.eq("entity_type", entityType);

  const { count, data } = await request;
  const rows = (data ?? []) as unknown as Row[];

  // `profiles` is only readable per-row, so the names are fetched in one go
  // for the actors actually on this page rather than joined server-side.
  const actorIds = [
    ...new Set(rows.map((row) => row.actor_id).filter(Boolean)),
  ];
  const { data: profileData } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds as string[])
    : { data: [] };

  const actorNames = new Map(
    (profileData ?? []).map((row) => [
      row.id as string,
      (row.full_name as string | null) ?? "Unnamed account",
    ]),
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Operations</p>
      <h1 className="type-display mt-2 flex items-center gap-3">
        <ScrollText aria-hidden="true" className="text-brand-text" size={34} />
        Audit log
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Every moderation decision, written by the database rather than the
        application, so an action cannot reach a record without also reaching
        this log. Append-only — entries are never edited or removed.
      </p>

      <nav aria-label="Filter by entity" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {ENTITY_TYPES.map((item) => {
            const active = item.value === entityType;
            return (
              <li key={item.label}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? "bg-foreground text-white"
                      : "border-border hover:border-brand-text/50 border"
                  }`}
                  href={
                    item.value
                      ? `/admin/audit-log?type=${item.value}`
                      : "/admin/audit-log"
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-8 text-sm">
          No entries yet. Moderation decisions will appear here as they are
          made.
        </p>
      ) : (
        <div className="border-border mt-8 overflow-x-auto rounded-3xl border bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">
              Moderation decisions, most recent first
            </caption>
            <thead className="border-border text-muted-foreground border-b text-xs tracking-widest uppercase">
              <tr>
                <th className="px-5 py-3 font-bold" scope="col">
                  When
                </th>
                <th className="px-5 py-3 font-bold" scope="col">
                  Action
                </th>
                <th className="px-5 py-3 font-bold" scope="col">
                  Entity
                </th>
                <th className="px-5 py-3 font-bold" scope="col">
                  Who
                </th>
                <th className="px-5 py-3 font-bold" scope="col">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href =
                  row.entity_id && ENTITY_HREF[row.entity_type]
                    ? ENTITY_HREF[row.entity_type](row.entity_id)
                    : null;
                const detail = Object.entries(row.detail ?? {})
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(" · ");

                return (
                  <tr
                    className="border-border border-b last:border-0"
                    key={row.id}
                  >
                    <td className="text-muted-foreground px-5 py-3 whitespace-nowrap">
                      {formatIndiaDateTime(row.created_at)}
                    </td>
                    <td className="px-5 py-3 font-bold">{row.action}</td>
                    <td className="px-5 py-3">
                      {href ? (
                        <Link
                          className="hover:text-brand-text underline"
                          href={href}
                        >
                          {row.entity_type}
                        </Link>
                      ) : (
                        row.entity_type
                      )}
                    </td>
                    <td className="text-muted-foreground px-5 py-3">
                      {row.actor_id
                        ? (actorNames.get(row.actor_id) ?? "Unknown account")
                        : "System"}
                    </td>
                    <td className="text-muted-foreground px-5 py-3">
                      {detail || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/audit-log"
        extraParams={{ type: entityType }}
        noun="entries"
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </main>
  );
}
