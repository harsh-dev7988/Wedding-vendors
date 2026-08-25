import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Concatenate every migration, in filename order, into one file that can be
 * pasted into the Supabase SQL editor.
 *
 * This exists because applying migrations with the CLI needs a personal access
 * token and the database password. The SQL editor needs neither, so this is the
 * lowest-friction path for a first deploy.
 *
 * The output is generated and gitignored — always edit the migrations.
 */
const MIGRATIONS_DIR = "supabase/migrations";
const OUT_DIR = "supabase/generated";
const OUT_FILE = join(OUT_DIR, "apply-all.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No migrations found in", MIGRATIONS_DIR);
  process.exit(1);
}

const header = `-- =========================================================================
-- GENERATED FILE — do not edit.
--
-- Concatenation of ${MIGRATIONS_DIR}/*.sql in filename order, for pasting
-- into the Supabase SQL editor when the CLI is not linked.
--
-- Regenerate with: npm run db:bundle
--
-- Safe to run once on an empty project. Running it twice will fail on
-- \`create type\` / \`create table\`, which is the intended guard against
-- accidentally re-applying it.
-- =========================================================================

`;

const body = files
  .map((name) => {
    const rule = "-".repeat(Math.max(0, 66 - name.length));
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8").trim();
    return `-- ----- ${name} ${rule}\n\n${sql}\n`;
  })
  .join("\n\n");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, header + body, "utf8");

console.log(`Bundled ${files.length} migrations into ${OUT_FILE}`);
for (const name of files) console.log(`  · ${name}`);
