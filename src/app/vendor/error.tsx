"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      description="The profile is temporarily unavailable. No enquiry or shortlist change was made."
      error={error}
      reset={reset}
      title="We couldn't load this vendor."
    />
  );
}
