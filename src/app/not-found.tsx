import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
      <p className="text-brand text-sm font-bold tracking-[0.16em] uppercase">
        404
      </p>
      <h1 className="mt-4 text-5xl font-bold">This page left the baraat.</h1>
      <p className="text-muted-foreground mt-5 max-w-xl leading-7">
        The vendor, city, or category may have moved. Explore the current
        marketplace instead.
      </p>
      <Link
        className="bg-foreground mt-8 rounded-full px-6 py-3 font-bold text-white"
        href="/vendors"
      >
        Explore vendors
      </Link>
    </main>
  );
}
