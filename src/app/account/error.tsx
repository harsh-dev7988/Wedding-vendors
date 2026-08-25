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
      description="Your enquiries and revealed contacts are safe. Try again in a moment."
      error={error}
      reset={reset}
      title="We couldn't load your account."
    />
  );
}
