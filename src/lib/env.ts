const DEFAULT_SITE_URL = "http://localhost:3000";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase public environment variables are not configured.",
    );
  }

  return { publishableKey, url };
}

/**
 * The deployed origin, without a trailing slash.
 *
 * A missing value used to fall back to localhost silently, which shipped
 * localhost URLs into `metadataBase`, robots.txt, sitemap.xml and — worst of
 * all — the `emailRedirectTo` on every sign-in link. In production that is a
 * hard failure, so we refuse to start instead of deploying a broken origin.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  // Vercel injects these, so a deploy works without extra configuration while
  // an explicit value still wins (and is required for a custom domain).
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const raw = explicit || (vercel ? `https://${vercel}` : undefined);

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in production. Set it to the deployed origin without a trailing slash. " +
          "It is used for metadataBase, robots.txt, sitemap.xml and the sign-in email redirect, all of which " +
          "would otherwise point at localhost.",
      );
    }
    return DEFAULT_SITE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an absolute URL, for example https://example.com",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
  }

  // Loopback stays permitted so a production build can be run and smoke-tested
  // locally; every other origin must be https.
  const isLoopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";

  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    !isLoopback
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use https in production.");
  }

  return parsed.origin;
}
