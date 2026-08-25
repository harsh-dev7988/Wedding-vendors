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
      description="No moderation decision was applied. Try again in a moment."
      error={error}
      reset={reset}
      title="The moderation console failed to load."
    />
  );
}
