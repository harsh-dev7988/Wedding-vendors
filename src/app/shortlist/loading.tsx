import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-14 md:px-8" id="main-content">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="mt-4 h-5 w-1/3" />
      <div className="mt-10 space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-40 w-full rounded-[2rem]" key={index} />
        ))}
      </div>
    </main>
  );
}
