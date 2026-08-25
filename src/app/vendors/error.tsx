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
      description="The marketplace directory is temporarily unavailable. Your search has not been lost."
      error={error}
      reset={reset}
      title="We couldn't load these listings."
    />
  );
}
