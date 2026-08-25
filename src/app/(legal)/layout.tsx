import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/trust-and-safety", label: "Trust and safety" },
  { href: "/contact", label: "Contact and grievances" },
] as const;

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:px-8 lg:grid-cols-[16rem_1fr]"
      id="main-content"
    >
      <nav
        aria-label="Legal and policy pages"
        className="lg:sticky lg:top-24 lg:self-start"
      >
        <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Policies
        </p>
        <ul className="mt-3 space-y-1 text-sm font-semibold">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                className="hover:bg-muted flex min-h-11 items-center rounded-xl px-3 transition"
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* `prose`-free: typography is set explicitly so these pages match the
          rest of the product rather than depending on a plugin. */}
      <div className="[&_a]:text-brand-text max-w-3xl [&_a]:font-semibold [&_a]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_li]:leading-7 [&_p]:mt-4 [&_p]:leading-7 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}
