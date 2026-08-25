/**
 * One badge for every moderation status across vendors, listings and reports.
 *
 * Colour alone never carries the meaning — the status word is always present —
 * so the palette is a scan aid rather than the information itself.
 */
const TONES: Record<string, string> = {
  actioned: "text-success border-success/40 border",
  approved: "text-success border-success/40 border",
  archived: "border-border text-muted-foreground border",
  dismissed: "border-border text-muted-foreground border",
  draft: "border-border text-muted-foreground border",
  open: "bg-brand-soft text-brand-text",
  pending_review: "bg-brand-soft text-brand-text",
  published: "text-success border-success/40 border",
  rejected: "border-border text-foreground border",
  reviewing: "bg-muted text-foreground",
  suspended: "border-border text-foreground border",
};

export function StatusPill({ status }: { readonly status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
        TONES[status] ?? "bg-muted text-foreground"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
