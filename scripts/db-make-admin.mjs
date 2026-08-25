import pg from "pg";

/**
 * Promote a signed-in user to administrator.
 *
 * `admin_roles` has RLS enabled, no policies and no grants, so there is
 * deliberately no API path to create the first admin. This is the documented
 * bootstrap operation from docs/CREDENTIALS_SETUP.md, run over a direct
 * connection.
 *
 *   SUPABASE_PROJECT_REF=... PGPASSWORD=... node scripts/db-make-admin.mjs you@example.com
 *
 * The user must have signed in at least once so that an auth.users row exists.
 */
const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;
const email = process.argv[2];

if (!REF || !PASSWORD || !email) {
  console.error(
    "Usage: SUPABASE_PROJECT_REF=<ref> PGPASSWORD=<pw> node scripts/db-make-admin.mjs <email>",
  );
  process.exit(1);
}

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

try {
  const { rows } = await client.query(
    "select id, email from auth.users where lower(email) = lower($1)",
    [email],
  );

  if (rows.length === 0) {
    const { rows: all } = await client.query(
      "select email from auth.users order by created_at desc limit 10",
    );
    console.error(`No auth user found for ${email}.`);
    console.error("Sign in through the app once first, then re-run this.");
    if (all.length) {
      console.error("\nExisting users:");
      for (const u of all) console.error(`  · ${u.email}`);
    } else {
      console.error("\nThere are no users in this project yet.");
    }
    process.exit(2);
  }

  await client.query(
    "insert into public.admin_roles (user_id) values ($1) on conflict (user_id) do nothing",
    [rows[0].id],
  );

  const { rows: admins } = await client.query(
    `select u.email from public.admin_roles a
     join auth.users u on u.id = a.user_id order by a.created_at`,
  );

  console.log(`${rows[0].email} is now an administrator.`);
  console.log("\nAdministrators:");
  for (const a of admins) console.log(`  · ${a.email}`);
} finally {
  await client.end().catch(() => {});
}
