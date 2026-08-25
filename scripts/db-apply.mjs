import { readFileSync } from "node:fs";
import pg from "pg";

/**
 * Apply the bundled migrations to a remote Postgres over a direct connection.
 *
 * Used when the Supabase CLI is not linked (which needs a personal access
 * token). The password is read from PGPASSWORD and is never written to disk or
 * echoed — only the host that succeeded is reported.
 *
 * Supabase direct connections (db.<ref>.supabase.co) are IPv6-only unless the
 * IPv4 add-on is enabled, so this falls back to the IPv4 session poolers.
 * Session mode (5432) is required: the transaction pooler on 6543 cannot run
 * DDL reliably.
 */
const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;
const SQL_FILE = process.argv[2] ?? "supabase/generated/apply-all.sql";
const DRY_RUN = process.argv.includes("--dry-run");

if (!REF || !PASSWORD) {
  console.error("SUPABASE_PROJECT_REF and PGPASSWORD must be set.");
  process.exit(1);
}

const POOLER_REGIONS = [
  "ap-south-1",
  "ap-southeast-1",
  "us-east-1",
  "us-west-1",
  "eu-central-1",
  "eu-west-2",
  "ap-northeast-1",
  "ap-southeast-2",
  "sa-east-1",
  "ca-central-1",
];

const candidates = [
  {
    label: "direct (IPv6)",
    config: {
      host: `db.${REF}.supabase.co`,
      port: 5432,
      user: "postgres",
      database: "postgres",
    },
  },
  ...POOLER_REGIONS.map((region) => ({
    label: `pooler ${region}`,
    config: {
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${REF}`,
      database: "postgres",
    },
  })),
];

async function connect() {
  for (const candidate of candidates) {
    const client = new pg.Client({
      ...candidate.config,
      password: PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
      query_timeout: 180000,
      statement_timeout: 180000,
    });

    try {
      await client.connect();
      console.log(`Connected via ${candidate.label}`);
      return client;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // A password failure means the host is right and the credential is not,
      // so there is no point trying the remaining regions.
      if (/password authentication failed/i.test(message)) {
        console.error(`${candidate.label}: authentication failed`);
        process.exit(2);
      }
      console.log(`  ${candidate.label}: ${message.split("\n")[0]}`);
      await client.end().catch(() => {});
    }
  }
  return null;
}

const client = await connect();
if (!client) {
  console.error("\nCould not reach the database on any host.");
  process.exit(3);
}

try {
  const { rows: before } = await client.query(
    `select count(*)::int as n from information_schema.tables
     where table_schema = 'public'`,
  );
  console.log(`Existing public tables: ${before[0].n}`);

  if (DRY_RUN) {
    const { rows } = await client.query("select current_database(), version()");
    console.log("Dry run only. Server:", rows[0].version.split(",")[0]);
    await client.end();
    process.exit(0);
  }

  const sql = readFileSync(SQL_FILE, "utf8");
  console.log(`Applying ${SQL_FILE} (${sql.length} bytes)…`);

  // One transaction: a failure anywhere rolls the whole thing back, so a retry
  // starts from a clean slate rather than a half-built schema.
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");

  const { rows: after } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  console.log(`\nApplied. public schema now has ${after.length} tables:`);
  for (const row of after) console.log(`  · ${row.table_name}`);
} catch (cause) {
  await client.query("rollback").catch(() => {});
  const error = cause instanceof Error ? cause : new Error(String(cause));
  console.error("\nFAILED — rolled back, no partial schema was left behind.");
  console.error(error.message);
  const detail = cause;
  if (detail && typeof detail === "object") {
    for (const key of ["position", "detail", "hint", "where"]) {
      if (key in detail && detail[key])
        console.error(`  ${key}: ${detail[key]}`);
    }
  }
  process.exitCode = 4;
} finally {
  await client.end().catch(() => {});
}
