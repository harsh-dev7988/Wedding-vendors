import type { Metadata } from "next";
import { Flag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ModerationForm } from "@/app/admin/moderation-form";
import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

import { StatusPill } from "../status-pill";

import { resolveReport } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Abuse reports",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

const STATUSES = [
  { label: "Open", value: "open" },
  { label: "In review", value: "reviewing" },
  { label: "Actioned", value: "actioned" },
  { label: "Dismissed", value: "dismissed" },
  { label: "All", value: "" },
] as const;

const REASON_LABELS: Record<string, string> = {
  duplicate: "Duplicate listing",
  inaccurate: "Inaccurate information",
  not_a_real_business: "Not a real business",
  offensive: "Offensive content",
  other: "Other",
  spam: "Spam",
};

/** What can be done next depends on where the report already is. */
const ACTIONS = {
  actioned: [{ label: "Reopen", value: "reopen" }],
  dismissed: [{ label: "Reopen", value: "reopen" }],
  open: [
    { label: "Start review", value: "start" },
    { label: "Dismiss", value: "dismiss", destructive: true },
  ],
  reviewing: [
    { label: "Mark actioned", value: "action" },
    { label: "Dismiss", value: "dismiss", destructive: true },
  ],
} as const;

const NOTICES: Record<string, string> = {
  "report-action": "Report marked as actioned.",
  "report-dismiss": "Report dismissed.",
  "report-reopen": "Report reopened.",
  "report-start": "Report moved into review.",
};

const ERRORS: Record<string, string> = {
  "invalid-action": "That report action was not recognised.",
  "report-update-failed":
    "The report could not be updated. It may have been resolved already.",
};

type ReportRow = {
  created_at: string;
  detail: string | null;
  id: string;
  listing_id: string | null;
  listing_slug: string | null;
  listing_status: string | null;
  listing_title: string | null;
  reason: string;
  reporter_name: string;
  resolution_note: string | null;
  resolved_at: string | null;
  review_body: string | null;
  review_id: string | null;
  status: keyof typeof ACTIONS;
  total_count: number;
};

export default async function AdminReportsPage({
  searchParams,
}: PageProps<"/admin/reports">) {
  await requireViewer("/admin/reports");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/account");

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "open";
  const status = STATUSES.some((item) => item.value === rawStatus)
    ? rawStatus
    : "open";
  const page = parsePage(params.page);

  const { data, error } = await supabase.rpc("admin_list_reports", {
    page_limit: PAGE_SIZE,
    page_offset: (page - 1) * PAGE_SIZE,
    requested_status: status || null,
  });

  const reports = (data ?? []) as unknown as ReportRow[];
  // The count is a window over the filtered set, so it comes back on every row
  // and is absent only when the page is empty.
  const total = reports[0]?.total_count ?? 0;

  const updated = typeof params.updated === "string" ? params.updated : null;
  const errorFlag = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <p className="text-brand-text eyebrow">Operations</p>
      <h1 className="type-page mt-2 flex items-center gap-3">
        <Flag aria-hidden="true" className="text-brand-text" size={34} />
        Abuse reports
      </h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Reports filed by signed-in customers against a published listing or
        review. Every decision is recorded in the audit log with the note you
        leave, and reopening a closed report clears its previous resolution.
      </p>

      {updated && NOTICES[updated] && (
        <StatusBanner className="mt-6">{NOTICES[updated]}</StatusBanner>
      )}
      {errorFlag && ERRORS[errorFlag] && (
        <FormAlert className="mt-6">{ERRORS[errorFlag]}</FormAlert>
      )}

      <nav aria-label="Filter by status" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {STATUSES.map((item) => {
            const active = item.value === status;
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
                      ? `/admin/reports?status=${item.value}`
                      : "/admin/reports?status="
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error && (
        <FormAlert className="mt-6">
          The report queue could not be loaded. The database migration for
          `admin_list_reports` may not have been applied yet.
        </FormAlert>
      )}

      {!error && reports.length === 0 && (
        <p className="border-border text-muted-foreground mt-8 rounded-3xl border border-dashed p-8 text-sm">
          {status === "open"
            ? "No open reports. Nothing needs attention right now."
            : "No reports with this status."}
        </p>
      )}

      <div className="mt-8 space-y-4">
        {reports.map((report) => {
          const target = report.listing_id
            ? {
                href: report.listing_slug
                  ? `/vendor/${report.listing_slug}`
                  : null,
                label: report.listing_title ?? "Listing removed",
                note: report.listing_status
                  ? `Listing is ${report.listing_status.replace("_", " ")}`
                  : null,
              }
            : {
                href: null,
                label: "Review",
                note: report.review_body
                  ? `“${report.review_body.slice(0, 160)}${report.review_body.length > 160 ? "…" : ""}”`
                  : "Review removed",
              };

          return (
            <article
              className="border-border rounded-3xl border bg-white p-6"
              key={report.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">
                    {target.href ? (
                      <Link
                        className="hover:text-brand-text"
                        href={target.href}
                      >
                        {target.label}
                      </Link>
                    ) : (
                      target.label
                    )}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {REASON_LABELS[report.reason] ?? report.reason} · reported
                    by {report.reporter_name} ·{" "}
                    {formatIndiaDateTime(report.created_at)}
                  </p>
                </div>
                <StatusPill status={report.status} />
              </div>

              {target.note && (
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {target.note}
                </p>
              )}

              {report.detail && (
                <blockquote className="border-border text-foreground mt-4 border-l-2 pl-4 text-sm leading-6">
                  {report.detail}
                </blockquote>
              )}

              {report.resolution_note && (
                <p className="bg-muted/60 mt-4 rounded-2xl p-3 text-sm leading-6">
                  <strong className="font-bold">Resolution:</strong>{" "}
                  {report.resolution_note}
                  {report.resolved_at &&
                    ` (${formatIndiaDateTime(report.resolved_at)})`}
                </p>
              )}

              <ModerationForm
                action={resolveReport}
                actions={ACTIONS[report.status] ?? ACTIONS.open}
                entityId={report.id}
                entityLabel="this report"
              />
            </article>
          );
        })}
      </div>

      <Pagination
        basePath="/admin/reports"
        extraParams={{ status }}
        noun="reports"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </main>
  );
}
