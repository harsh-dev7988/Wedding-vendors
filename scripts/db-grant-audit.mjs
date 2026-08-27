/**
 * Every column the app selects, checked against what the database will hand out.
 *
 * These tables use column-level grants, which is the right way to keep
 * coordinates, moderation notes and payment identifiers away from clients. The
 * cost is that `alter table ... add column` grants nothing: a column added by a
 * later migration is invisible to `anon` and `authenticated`, and PostgREST
 * answers any query naming it with "permission denied for table" — the whole
 * request, not just that column.
 *
 * That is not a subtle failure but it is a silent one. supabase-js returns
 * `{ data: null }`, the page treats null as "not found", and the vendor sees a
 * 404 on a lead that plainly exists. `leads.first_vendor_response_at` did
 * exactly that, and nothing in the type system or the build could notice,
 * because the column does exist — it is only unreadable.
 *
 *   SUPABASE_PROJECT_REF=... PGPASSWORD=... npm run db:grants
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;

if (!REF || !PASSWORD) {
  console.error("SUPABASE_PROJECT_REF and PGPASSWORD must be set.");
  process.exit(1);
}

async function sourceFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Pull `(table, columns)` pairs out of the source.
 *
 * Deliberately conservative: it only reads a `.select("…")` whose literal
 * follows a `.from("…")` closely enough to be the same chain, and it skips
 * embeds — `listings(title, slug)` names another table, whose own `.from()`
 * this audit will not have seen. Missing a call is fine; inventing one is not.
 */
function selectsIn(source) {
  const pairs = [];
  const from = /\.from\(\s*"([a-z_]+)"\s*\)/g;
  let match;
  while ((match = from.exec(source))) {
    const table = match[1];
    const after = source.slice(match.index, match.index + 900);
    const select = /\.select\(\s*(?:\n\s*)?"([^"]*)"/.exec(after);
    if (!select) continue;
    const body = select[1];
    if (body.trim() === "*" || body.trim() === "") continue;

    // Drop embedded relations wholesale: `listings(title, slug)` and anything
    // inside the parentheses belongs to another table.
    const flat = body.replace(/[a-z_]+\s*(?:![a-z_]+)?\s*\([^)]*\)/g, "");
    const columns = flat
      .split(",")
      .map((piece) => piece.trim())
      .filter(Boolean)
      // `count`, `alias:column` and similar are not plain column names.
      .map((piece) =>
        piece.includes(":") ? piece.split(":")[1].trim() : piece,
      )
      .filter((piece) => /^[a-z_][a-z0-9_]*$/.test(piece));

    if (columns.length) pairs.push({ columns, table });
  }
  return pairs;
}

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

const { rows: grantRows } = await client.query(
  `select table_name, column_name, grantee
   from information_schema.column_privileges
   where table_schema = 'public' and privilege_type = 'SELECT'
     and grantee in ('anon', 'authenticated')`,
);
const { rows: columnRows } = await client.query(
  `select table_name, column_name from information_schema.columns
   where table_schema = 'public'`,
);
await client.end();

const grantedTo = new Map();
for (const row of grantRows) {
  const key = `${row.table_name}.${row.column_name}`;
  if (!grantedTo.has(key)) grantedTo.set(key, new Set());
  grantedTo.get(key).add(row.grantee);
}
const realColumns = new Set(
  columnRows.map((row) => `${row.table_name}.${row.column_name}`),
);
// Only tables that use column-level grants can have this problem at all.
const columnGranted = new Set(grantRows.map((row) => row.table_name));

const files = await sourceFiles(path.resolve("src"));
const findings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const { columns, table } of selectsIn(source)) {
    if (!columnGranted.has(table)) continue;
    for (const column of columns) {
      const key = `${table}.${column}`;
      if (!realColumns.has(key)) continue; // an alias or an embed we mis-read
      if ((grantedTo.get(key)?.size ?? 0) > 0) continue;
      findings.push({
        column,
        file: path.relative(process.cwd(), file),
        table,
      });
    }
  }
}

for (const finding of findings) {
  console.log(
    `  ${finding.table}.${finding.column} is selected but granted to nobody`,
  );
  console.log(`      ${finding.file}`);
}

console.log(
  `\n${findings.length} column(s) selected by the app that no client role can read`,
);
process.exit(findings.length ? 1 : 0);
