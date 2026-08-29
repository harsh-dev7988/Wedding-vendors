/**
 * Follow every internal link the site offers and check where it lands.
 *
 * The other suites check pages this repo already knows about. This one starts
 * from the front door and walks what the site actually links to, which is the
 * only way to catch a navigation entry pointing at a page that no longer
 * exists — the failure mode a taxonomy that lives in the database makes easy,
 * because a menu built from rows can outrun the routes built for them.
 *
 *   BASE=http://localhost:3235 node scripts/link-audit.mjs
 */
const BASE = process.env.BASE ?? "http://localhost:3235";
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 400);
/**
 * Crawl as somebody with a city remembered.
 *
 * The city context personalises where some links point, which introduces
 * exactly one new way to break: a personalised destination that does not
 * exist. Running the whole crawl with `CITY=mumbai` is how that gets caught,
 * and it has to stay clean alongside the unset run — an explicit URL must
 * still win, so both passes should reach the same set of pages.
 */
const CITY = process.env.CITY ?? "";

/** Signed-in areas answer 307 to sign-in, which is correct, not a break. */
const AUTH_PREFIXES = [
  "/account",
  "/admin",
  "/shortlist",
  "/vendor/dashboard",
  "/for-vendors/apply",
];

/** Enquiring requires an account by design: the whole contact-reveal model
 *  depends on knowing who asked. */
const AUTH_SUFFIXES = ["/enquire", "/review", "/report"];

const seen = new Map();
const queue = ["/"];
const findings = [];
const linkedFrom = new Map();

const isInternal = (href) =>
  href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/_next");

function normalise(href) {
  const [path] = href.split("#");
  if (!path) return null;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

async function visit(path) {
  const response = await fetch(BASE + path, {
    headers: CITY ? { cookie: `wv_city=${CITY}` } : {},
    redirect: "manual",
  });
  const status = response.status;
  // Next sometimes emits `location` twice with the same value on a redirect
  // rendered on demand. Browsers and fetch-with-follow both take the first and
  // land correctly; only manual mode sees them joined by a comma. Take the
  // first value rather than reporting a URL nothing ever requested.
  const location = response.headers.get("location")?.split(", ")[0] ?? null;
  const contentType = response.headers.get("content-type") ?? "";
  let html = "";
  if (contentType.includes("text/html")) html = await response.text();
  return { html, location, status };
}

while (queue.length > 0 && seen.size < MAX_PAGES) {
  const path = queue.shift();
  if (seen.has(path)) continue;

  const { html, location, status } = await visit(path);
  seen.set(path, status);

  const authGated =
    AUTH_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    AUTH_SUFFIXES.some((suffix) => path.endsWith(suffix));

  if (status === 404) {
    findings.push({
      detail: `linked from ${[...(linkedFrom.get(path) ?? [])].slice(0, 2).join(", ")}`,
      kind: "dead-link",
      path,
    });
    continue;
  }
  if (status >= 500) {
    findings.push({ detail: String(status), kind: "server-error", path });
    continue;
  }
  if (status >= 300 && status < 400) {
    // A redirect is fine; a redirect that lands on a 404 is not.
    const target = normalise(new URL(location ?? "/", BASE).pathname);
    if (target && !seen.has(target)) queue.push(target);
    if (!authGated && status === 307 && target?.startsWith("/sign-in")) {
      findings.push({
        detail: "a public page should not require signing in",
        kind: "unexpected-auth-redirect",
        path,
      });
    }
    continue;
  }

  // Only follow links out of public pages: a signed-out account page is a
  // sign-in form, and crawling its links tells us nothing about the product.
  if (authGated) continue;

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, "&");
    if (!isInternal(href)) continue;
    const target = normalise(href.split("?")[0]);
    if (!target) continue;
    if (!linkedFrom.has(target)) linkedFrom.set(target, new Set());
    linkedFrom.get(target).add(path);
    if (!seen.has(target) && !queue.includes(target)) queue.push(target);
  }
}

// Every URL the sitemap offers has to resolve: submitting a 404 or a redirect
// wastes crawl budget and reports as an error in Search Console.
const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  new URL(m[1]).pathname.replace(/\/$/, ""),
);
let sitemapChecked = 0;
for (const path of sitemapUrls.slice(0, 120)) {
  sitemapChecked += 1;
  const known = seen.get(path || "/");
  const status = known ?? (await visit(path || "/")).status;
  if (!known) seen.set(path || "/", status);
  if (status !== 200) {
    findings.push({
      detail: `sitemap offers it but it answers ${status}`,
      kind: "sitemap-broken",
      path,
    });
  }
}

for (const finding of findings) {
  console.log(
    `  ${finding.kind.padEnd(26)} ${finding.path}  ${finding.detail}`,
  );
}
console.log(`\npages crawled: ${seen.size}`);
console.log(`sitemap urls checked: ${sitemapChecked}`);
console.log(`findings: ${findings.length}`);
process.exit(findings.length > 0 ? 1 : 0);
