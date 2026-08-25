import { cn } from "@/lib/utils";

/** Neutral placeholder block. Animation is disabled under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-2xl", className)}
    />
  );
}

export function DirectorySkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-8" id="main-content">
      <p className="sr-only" role="status">
        Loading listings…
      </p>
      <Skeleton className="h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-24 w-full rounded-3xl" />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
            <Skeleton className="mt-4 h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
