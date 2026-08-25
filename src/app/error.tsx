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
      description="Your data is safe. Try the request again, or head back to the directory."
      error={error}
      reset={reset}
      title="We couldn't load this page."
    />
  );
}
