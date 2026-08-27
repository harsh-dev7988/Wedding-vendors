/**
 * Seed (or remove) the accounts the signed-in audit needs.
 *
 * Every suite in this repo runs logged out, so the vendor dashboard, listing
 * form, billing, admin queue and account pages are checked only by reading
 * code — and the last three visual bugs reported by hand were all on those
 * pages. Automated coverage there needs a session, and a session needs a user
 * with a password: the product itself only offers magic links and Google.
 *
 * These users are therefore a test fixture, not a product feature. They are
 * confined to the @audit.invalid domain (RFC 2606 reserved, so it can never
 * receive mail), created with `--seed` and removed completely with `--cleanup`.
 * Run the cleanup when you are done; leaving them costs nothing but they are
 * real credentials on a real project.
 *
 *   SUPABASE_PROJECT_REF=... PGPASSWORD=... node scripts/db-seed-test-users.mjs --seed
 *   ... --cleanup
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;
const MODE = process.argv.includes("--cleanup") ? "cleanup" : "seed";

if (!REF || !PASSWORD) {
  console.error("SUPABASE_PROJECT_REF and PGPASSWORD must be set.");
  process.exit(1);
}

/** Reserved by RFC 2606: guaranteed never to resolve or receive mail. */
export const DOMAIN = "audit.invalid";
export const TEST_PASSWORD = "audit-only-Aa1!" + REF.slice(0, 6);

const USERS = [
  { email: `customer@${DOMAIN}`, kind: "customer" },
  { email: `vendor@${DOMAIN}`, kind: "vendor" },
  { email: `admin@${DOMAIN}`, kind: "admin" },
];

const client = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${REF}`,
  database: "postgres",
  password: PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();

if (MODE === "cleanup") {
  // The vendor fixture owns rows in half the schema; every one of those tables
  // cascades from auth.users, so deleting the user is the whole cleanup.
  const { rowCount } = await client.query(
    `delete from auth.users where email like $1`,
    [`%@${DOMAIN}`],
  );
  const left = (
    await client.query(
      `select count(*)::int as n from public.vendors where business_name like 'Audit %'`,
    )
  ).rows[0].n;
  if (left > 0) {
    await client.query(
      `delete from public.vendors where business_name like 'Audit %'`,
    );
  }
  console.log(
    `Removed ${rowCount} test user(s) and ${left} leftover vendor(s).`,
  );
  await client.end();
  process.exit(0);
}

const created = {};

for (const user of USERS) {
  const existing = await client.query(
    `select id from auth.users where email = $1`,
    [user.email],
  );

  let id = existing.rows[0]?.id;

  if (!id) {
    id = randomUUID();
    // A hand-built row rather than the admin API, which would need the service
    // role key. Password sign-in only needs a bcrypt hash and a confirmed
    // email; the identity row is what makes GoTrue treat it as an email user.
    await client.query(
      `insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data
       ) values (
         $1, '00000000-0000-0000-0000-000000000000', 'authenticated',
         'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')),
         now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', $4)
       )`,
      [id, user.email, TEST_PASSWORD, `Audit ${user.kind}`],
    );
    await client.query(
      `insert into auth.identities (
         id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
       ) values (
         gen_random_uuid(), $1, $1, jsonb_build_object('sub', $1::text, 'email', $2), 'email', now(), now(), now()
       )`,
      [id, user.email],
    );
  } else {
    // Keep the password in step if the ref (and therefore the password) moved.
    await client.query(
      `update auth.users
       set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = $1`,
      [id, TEST_PASSWORD],
    );
  }

  await client.query(
    `insert into public.profiles (id, full_name) values ($1, $2)
     on conflict (id) do update set full_name = excluded.full_name`,
    [id, `Audit ${user.kind}`],
  );

  if (user.kind === "admin") {
    await client.query(
      `insert into public.admin_roles (user_id) values ($1) on conflict do nothing`,
      [id],
    );
  }

  if (user.kind === "vendor") {
    let vendorId = (
      await client.query(
        `select id from public.vendors where business_name = 'Audit Vendor Co'`,
      )
    ).rows[0]?.id;

    if (!vendorId) {
      vendorId = randomUUID();
      await client.query(
        `insert into public.vendors (id, business_name, status)
         values ($1, 'Audit Vendor Co', 'approved')`,
        [vendorId],
      );
    }
    await client.query(
      `insert into public.vendor_contacts (vendor_id, phone_e164, email)
       values ($1, '+919000000000', $2)
       on conflict (vendor_id) do nothing`,
      [vendorId, user.email],
    );
    await client.query(
      `insert into public.vendor_members (vendor_id, user_id, role)
       values ($1, $2, 'owner') on conflict do nothing`,
      [vendorId, id],
    );
    created.vendorId = vendorId;
  }

  created[user.kind] = { email: user.email, id };
  console.log(`  ${user.kind.padEnd(9)} ${user.email}`);
}

console.log("\nSeeded. Remove them with --cleanup when the audit is done.");
await client.end();
