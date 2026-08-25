import pg from "pg";

/** Post-deploy smoke checks against the remote database. */
const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;

const client = new pg.Client({
  host: `aws-0-${process.env.SUPABASE_REGION ?? "ap-south-1"}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${REF}`,
  database: "postgres",
  password: PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();

const checks = [];
const check = (name, pass, detail = "") =>
  checks.push({ name, pass, detail: String(detail) });

const one = async (sql) => (await client.query(sql)).rows[0];

// The defect that blocked every live workflow: a doubled backslash made these
// patterns require a literal backslash where + and . were intended.
const re = await one(`select
  ('+919876543210' ~ '^\\+[1-9][0-9]{7,14}$')      as phone_ok,
  ('919876543210'  ~ '^\\+[1-9][0-9]{7,14}$')      as phone_reject,
  ('owner@studio.co.in' ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') as email_ok,
  current_setting('standard_conforming_strings')   as scs`);
check(
  "E.164 phone accepted (P1-01)",
  re.phone_ok === true,
  `+919876543210 -> ${re.phone_ok}`,
);
check(
  "phone without + rejected",
  re.phone_reject === false,
  `919876543210 -> ${re.phone_reject}`,
);
check(
  "email accepted (P1-01)",
  re.email_ok === true,
  `owner@studio.co.in -> ${re.email_ok}`,
);
check("standard_conforming_strings on", re.scs === "on", re.scs);

// A real insert is the only proof the CHECK constraints agree with the app.
try {
  await client.query("begin");
  const v = await one(
    `insert into public.vendors (business_name, status) values ('Smoke Test Co', 'pending_review') returning id`,
  );
  await client.query(
    `insert into public.vendor_contacts (vendor_id, phone_e164, email) values ($1, '+919876543210', 'owner@studio.co.in')`,
    [v.id],
  );
  check("vendor_contacts accepts real phone + email", true, "insert succeeded");
  await client.query("rollback");
} catch (cause) {
  await client.query("rollback").catch(() => {});
  check("vendor_contacts accepts real phone + email", false, cause.message);
}

const counts = await one(`select
  (select count(*) from public.cities)             as cities,
  (select count(*) from public.categories)         as categories,
  (select count(*) from public.subscription_plans) as plans`);
check("12 cities seeded", Number(counts.cities) === 12, counts.cities);
check(
  "5 categories seeded",
  Number(counts.categories) === 5,
  counts.categories,
);
check("3 plans seeded", Number(counts.plans) === 3, counts.plans);

const rls = await one(`select count(*)::int as n from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
check("RLS enabled on every public table", rls.n === 0, `${rls.n} without RLS`);

const fns = await one(`select count(*)::int as n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef`);
check("security definer functions created", fns.n >= 15, `${fns.n} found`);

const paths = await one(`select count(*)::int as n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
check(
  "every definer function pins search_path",
  paths.n === 0,
  `${paths.n} unpinned`,
);

const grants = await one(`select
  has_table_privilege('anon','public.vendor_contacts','select')          as anon_contacts,
  has_column_privilege('anon','public.reviews','customer_id','select')   as anon_reviewer,
  has_column_privilege('authenticated','public.vendors','status','update') as vendor_selfapprove`);
check("anon cannot read vendor_contacts", grants.anon_contacts === false);
check("anon cannot read reviewer ids", grants.anon_reviewer === false);
check("vendors cannot self-approve", grants.vendor_selfapprove === false);

const buckets = await one(`select
  (select public from storage.buckets where id='vendor-media')        as media_public,
  (select public from storage.buckets where id='vendor-verification') as verification_public`);
check("vendor-media bucket is public", buckets.media_public === true);
check(
  "vendor-verification bucket is PRIVATE",
  buckets.verification_public === false,
);

const policies = await one(`select
  (select count(*)::int from pg_policies where schemaname = 'public')  as public_n,
  (select count(*)::int from pg_policies where schemaname = 'storage'
     and (qual like '%vendor-media%' or qual like '%vendor-verification%'
          or with_check like '%vendor-media%' or with_check like '%vendor-verification%')) as storage_n`);
check(
  "public RLS policies created",
  policies.public_n >= 40,
  `${policies.public_n} policies`,
);
check(
  "storage policies created",
  policies.storage_n >= 5,
  `${policies.storage_n} policies`,
);

await client.end();

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(
    `${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`,
  );
}
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed`,
);
process.exit(failed.length ? 1 : 0);
