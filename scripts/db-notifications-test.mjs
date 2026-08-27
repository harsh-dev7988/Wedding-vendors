/**
 * Prove moderation writes notifications, inside a transaction that is always
 * rolled back because this runs against the live database.
 *
 * Rows are identified by diffing id sets, not by `order by created_at desc`:
 * `created_at` defaults to now(), which is the *transaction* timestamp, so
 * every row written here shares one value and ordering by it returns an
 * arbitrary row. That is what made the first run of this file report failures
 * that were not real.
 */
import pg from "pg";

const REF = process.env.SUPABASE_PROJECT_REF;
const client = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${REF}`,
  database: "postgres",
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const pass = [];
const fail = [];
const check = (name, ok, detail = "") =>
  (ok ? pass : fail).push(`${name}${detail ? "  — " + detail : ""}`);

await client.connect();

const enumValues = (
  await client.query(
    `select e.enumlabel from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     where t.typname = 'notification_kind' order by e.enumsortorder`,
  )
).rows.map((r) => r.enumlabel);
check("vendor_suspended kind exists", enumValues.includes("vendor_suspended"));

const triggers = (
  await client.query(
    `select tgname from pg_trigger
     where not tgisinternal and tgname in ('vendors_notify_members','listings_notify_members')`,
  )
).rows.map((r) => r.tgname);
check(
  "vendors_notify_members trigger exists",
  triggers.includes("vendors_notify_members"),
);
check(
  "listings_notify_members still exists",
  triggers.includes("listings_notify_members"),
);

const clientGrants = (
  await client.query(
    `select count(*)::int as n from information_schema.role_routine_grants
     where routine_schema = 'public' and routine_name = 'notify_vendor_members'
       and grantee in ('anon','authenticated','PUBLIC')`,
  )
).rows[0].n;
check("notify_vendor_members is not callable by clients", clientGrants === 0);

// The RPCs must hold no notification logic, or every decision doubles.
const bodies = (
  await client.query(
    `select proname, prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and proname in ('admin_moderate_vendor','admin_moderate_listing')`,
  )
).rows;
check(
  "moderation RPCs contain no notification calls",
  bodies.every((r) => !r.prosrc.includes("notify_vendor_members")),
  bodies.map((r) => r.proname).join(", "),
);

const ids = async () =>
  new Set(
    (await client.query(`select id from public.notifications`)).rows.map(
      (r) => r.id,
    ),
  );
const written = async (before) => {
  const after = await ids();
  const fresh = [...after].filter((id) => !before.has(id));
  if (fresh.length === 0) return [];
  return (
    await client.query(
      `select kind, title, body, url, entity_type, entity_id
       from public.notifications where id = any($1)`,
      [fresh],
    )
  ).rows;
};

await client.query("begin");
try {
  const admin = (
    await client.query(`select user_id from public.admin_roles limit 1`)
  ).rows[0];
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: admin.user_id, role: "authenticated" }),
  ]);
  await client.query(`set local role authenticated`);

  const listing = (
    await client.query(
      `select l.id, l.title, l.vendor_id from public.listings l
       join public.vendors v on v.id = l.vendor_id
       where v.status = 'approved' limit 1`,
    )
  ).rows[0];
  const members = (
    await client.query(
      `select count(*)::int as n from public.vendor_members where vendor_id = $1`,
      [listing.vendor_id],
    )
  ).rows[0].n;
  check(
    "found an approved vendor with a listing",
    Boolean(listing) && members > 0,
  );

  // --- listing rejected -------------------------------------------------
  let before = await ids();
  await client.query(`select public.admin_moderate_listing($1, 'reject', $2)`, [
    listing.id,
    "Please add a photo of the main hall.",
  ]);
  let rows = await written(before);
  check(
    "rejecting writes exactly one notification per member",
    rows.length === members,
    `${rows.length} for ${members} member(s)`,
  );
  check(
    "kind is listing_rejected",
    rows.every((r) => r.kind === "listing_rejected"),
  );
  check(
    "the moderator note is the body",
    rows[0]?.body === "Please add a photo of the main hall.",
    rows[0]?.body,
  );
  check(
    "it links to the listings page, not the overview",
    rows[0]?.url === "/vendor/dashboard/listings",
    rows[0]?.url,
  );
  check("entity points at the listing", rows[0]?.entity_id === listing.id);

  // --- vendor suspended --------------------------------------------------
  before = await ids();
  await client.query(`select public.admin_moderate_vendor($1, 'suspend', $2)`, [
    listing.vendor_id,
    "Documents could not be verified.",
  ]);
  rows = await written(before);
  const vendorRows = rows.filter((r) => r.entity_type === "vendor");
  check(
    "suspending writes one vendor notification per member",
    vendorRows.length === members,
    `${vendorRows.length} vendor rows of ${rows.length} total`,
  );
  check(
    "kind is vendor_suspended",
    vendorRows[0]?.kind === "vendor_suspended",
    vendorRows[0]?.kind,
  );
  check(
    "the suspension note is the body",
    vendorRows[0]?.body === "Documents could not be verified.",
    vendorRows[0]?.body,
  );

  // --- vendor approved ---------------------------------------------------
  before = await ids();
  await client.query(
    `select public.admin_moderate_vendor($1, 'approve', null)`,
    [listing.vendor_id],
  );
  rows = (await written(before)).filter((r) => r.entity_type === "vendor");
  check("approving notifies", rows.length === members, `${rows.length} rows`);
  check(
    "kind is vendor_approved",
    rows[0]?.kind === "vendor_approved",
    rows[0]?.kind,
  );
  check(
    "approval says what to do next",
    (rows[0]?.body ?? "").includes("add listings now"),
    rows[0]?.body,
  );
  check(
    "approval sends them to their listings",
    rows[0]?.url === "/vendor/dashboard/listings",
    rows[0]?.url,
  );

  // A write that does not change status must stay silent. Run as the owner:
  // `authenticated` is correctly denied UPDATE on vendors, which would abort
  // the transaction rather than test the trigger.
  await client.query(`reset role`);
  before = await ids();
  await client.query(
    `update public.vendors set moderation_note = 'touch' where id = $1`,
    [listing.vendor_id],
  );
  check(
    "an unrelated update notifies nobody",
    (await written(before)).length === 0,
  );
} finally {
  await client.query("rollback");
}

const leaked = (
  await client.query(
    `select count(*)::int as n from public.notifications
     where body in ('Please add a photo of the main hall.','Documents could not be verified.')`,
  )
).rows[0].n;
check("test data rolled back", leaked === 0, `${leaked} rows left`);

await client.end();

for (const p of pass) console.log("  PASS  " + p);
for (const f of fail) console.log("  FAIL  " + f);
console.log(`\n${pass.length}/${pass.length + fail.length} passed`);
process.exit(fail.length ? 1 : 0);
