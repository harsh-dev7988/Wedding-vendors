"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * A submit button that disables itself while its form is in flight.
 *
 * Without this, a double click fired two identical Server Action requests. The
 * database rate limits are check-then-act, so concurrent submissions could both
 * pass the same snapshot — the advisory locks in `submit_enquiry_and_reveal`
 * and `submit_review` close that at the source, and this closes the common
 * case at the surface.
 */
export function SubmitButton({
  children,
  className,
  disabled = false,
  name,
  pendingLabel = "Working…",
  value,
}: {
  children: ReactNode;
  className?: string;
  /** Blocks submission for a reason of the caller's own, such as a file still
   * being prepared. Combined with, not a replacement for, the pending state. */
  disabled?: boolean;
  name?: string;
  pendingLabel?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const blocked = pending || disabled;

  return (
    <button
      aria-disabled={blocked}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-progress disabled:opacity-70",
        className,
      )}
      disabled={blocked}
      name={name}
      type="submit"
      value={value}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" size={17} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
