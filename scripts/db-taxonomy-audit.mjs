/**
 * Does the taxonomy actually work end to end, for a category nobody has used?
 *
 * The link audit proves every page resolves. This proves the other half: that a
 * listing filed under one of the newly promoted categories is created, found,
 * counted and shown in the right section — and that a venue subtype behaves as
 * a venue rather than as a service that happens to be filed oddly.
 *
 * Everything runs inside a transaction that is always rolled back.
 *
 *   SUPABASE_PROJECT_REF=... PGPASSWORD=... npm run db:taxonomy
 */
import pg from "pg";

const REF = process.env.SUPABASE_PROJECT_REF;
if (!REF || !process.env.PGPASSWORD) {
  console.error("SUPABASE_PROJECT_REF and PGPASSWORD must be set.");
  process.exit(1);
}

const client = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${REF}`,
  database: "postgres",
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  query_timeout: 120000,
});
await client.connect();

const pass = [];
const fail = [];
const check = (ok, name, detail = "") =>
  (ok ? pass : fail).push(`${name}${detail ? "  — " + detail : ""}`);

// --- shape ----------------------------------------------------------------
const { rows: shape } = await client.query(`
  select
    count(*)::int as total,
    count(*) filter (where is_active)::int as promoted,
    count(*) filter (where kind = 'venue')::int as venues,
    count(*) filter (where kind = 'venue' and parent_slug is not null)::int as subtypes,
    -- Only categories a vendor can actually choose. A superseded one keeps
    -- whatever it had; nothing will ever be filed under it again.
    count(*) filter (
      where allowed_price_units = array['on_request']::public.price_unit[]
        and slug <> 'planners-decorators'
    )::int as units_unset,
    count(distinct group_slug)::int as groups
  from public.categories`);
const s = shape[0];
check(s.total >= 32, "the full taxonomy is present", `${s.total} categories`);
check(s.groups >= 13, "grouped", `${s.groups} groups`);
check(s.subtypes === 9, "nine venue subtypes", String(s.subtypes));
check(
  s.units_unset === 0,
  "every category declares its price units",
  `${s.units_unset} left on the default`,
);

const { rows: orphans } = await client.query(`
  select c.slug from public.categories c
  where c.parent_slug is not null
    and not exists (select 1 from public.categories p where p.slug = c.parent_slug)`);
check(orphans.length === 0, "no subtype points at a missing parent");

const { rows: mismatched } = await client.query(`
  select c.slug from public.categories c
  join public.categories p on p.slug = c.parent_slug
  where p.kind <> c.kind`);
check(mismatched.length === 0, "every subtype shares its parent's kind");

// --- a listing in a category nobody has used ------------------------------
await client.query("begin");
try {
  const vendor = (
    await client.query(
      `select id from public.vendors where status = 'approved' limit 1`,
    )
  ).rows[0];
  const city = (
    await client.query(`select id, slug from public.cities limit 1`)
  ).rows[0];

  for (const slug of ["mehendi-artists", "banquet-halls"]) {
    const category = (
      await client.query(
        `select id, kind from public.categories where slug = $1`,
        [slug],
      )
    ).rows[0];

    const listing = (
      await client.query(
        `insert into public.listings
           (vendor_id, category_id, primary_city_id, slug, title, summary, description, status, price_unit)
         values ($1, $2, $3, $4, $5, $6, $7, 'published', 'on_request')
         returning id`,
        [
          vendor.id,
          category.id,
          city.id,
          `audit-${slug}`,
          `Audit ${slug}`,
          "A fixture created inside a transaction that is rolled back.",
          "A fixture created inside a transaction that is rolled back. ".repeat(
            3,
          ),
        ],
      )
    ).rows[0];
    check(Boolean(listing?.id), `a listing can be created in ${slug}`);

    // Publishing must have promoted the category, by trigger.
    const promoted = (
      await client.query(
        `select is_active from public.categories where id = $1`,
        [category.id],
      )
    ).rows[0].is_active;
    check(promoted === true, `publishing keeps ${slug} promoted`);

    // It must be findable by its own category...
    const byCategory = (
      await client.query(
        `select count(*)::int as n from public.search_listings(
           $1, $2, null, null, null, null, false, null, null, 'recent', 24, 0, null, null, null)`,
        [city.slug, slug],
      )
    ).rows[0].n;
    check(
      byCategory > 0,
      `${slug} is findable by category`,
      `${byCategory} found`,
    );

    // ...and by its section, which is what /vendors and /venues actually ask.
    const bySection = (
      await client.query(
        `select count(*)::int as n from public.search_listings(
           $1, null, null, null, null, null, false, null, null, 'recent', 24, 0, null, null, $2)`,
        [city.slug, category.kind],
      )
    ).rows[0].n;
    check(
      bySection > 0,
      `${slug} appears in the ${category.kind} section`,
      `${bySection} found`,
    );

    // And must NOT appear in the other section.
    const other = category.kind === "venue" ? "service" : "venue";
    const leaked = (
      await client.query(
        `select count(*)::int as n from public.search_listings(
           $1, null, null, null, null, null, false, null, null, 'recent', 24, 0, null, null, $2)
         where slug = $3`,
        [city.slug, other, `audit-${slug}`],
      )
    ).rows[0].n;
    check(leaked === 0, `${slug} does not leak into the ${other} section`);
  }
} finally {
  await client.query("rollback");
}

const leftovers = (
  await client.query(
    `select count(*)::int as n from public.listings where slug like 'audit-%'`,
  )
).rows[0].n;
check(leftovers === 0, "test data rolled back", `${leftovers} left`);

await client.end();

for (const p of pass) console.log("  PASS  " + p);
for (const f of fail) console.log("  FAIL  " + f);
console.log(`\n${pass.length}/${pass.length + fail.length} passed`);
process.exit(fail.length ? 1 : 0);
