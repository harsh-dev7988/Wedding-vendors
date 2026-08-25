import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Error output. `role="alert"` makes assistive technology announce the message
 * when it appears — previously every failure was a silent `<p>`.
 */
export function FormAlert({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;

  return (
    <p
      className={cn(
        "border-brand-text/25 bg-brand-soft text-brand-text flex items-start gap-2 rounded-2xl border p-4 text-sm font-semibold",
        className,
      )}
      id={id}
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <span>{children}</span>
    </p>
  );
}

/** Confirmation output. `role="status"` announces politely. */
export function StatusBanner({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <p
      className={cn(
        "border-success/25 text-success flex items-start gap-2 rounded-2xl border bg-[color:var(--success-soft)] p-4 text-sm font-semibold",
        className,
      )}
      role="status"
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <span>{children}</span>
    </p>
  );
}

/** Per-field error, wired to the input through `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <span className="text-brand-text text-xs font-semibold" id={id}>
      {message}
    </span>
  );
}
