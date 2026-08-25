"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Shared body for every error boundary.
 *
 * `error.message` is redacted by Next in production builds and replaced with a
 * digest, so nothing internal is rendered here — only the digest, which is what
 * support needs to correlate a report with a server log line.
 */
export function ErrorState({
  description,
  error,
  reset,
  title,
}: {
  description: string;
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center"
      id="main-content"
    >
      <p className="text-brand-text eyebrow">Something went wrong</p>
      <h1 className="type-title mt-4 sm:text-5xl">{title}</h1>
      <p className="text-muted-foreground mt-5 leading-7">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          className="bg-foreground hover:bg-brand-solid-hover inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white transition"
          onClick={reset}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} /> Try again
        </button>
        <Link
          className="border-border hover:border-brand-text/50 inline-flex min-h-12 items-center rounded-full border px-6 font-bold transition"
          href="/vendors"
        >
          Browse vendors
        </Link>
      </div>
      {error.digest && (
        <p className="text-muted-foreground mt-6 text-xs">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
