import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import pg from "pg";

/**
 * Bulk-load India Post pincodes with coordinates.
 *
 * Radius search needs a coordinate for every pincode a visitor might type.
 * Geocoding them on demand would need a server-side API key, cost money and
 * make the first search for each pincode slow; the data is public, static and
 * small, so it belongs in the database.
 *
 *   SUPABASE_PROJECT_REF=... PGPASSWORD=... \
 *     node scripts/import-pincodes.mjs pincodes.csv [--dry-run]
 *
 * Accepts a CSV with a header row. Column names vary between the published
 * datasets, so several spellings are recognised for each field. The only
 * required ones are the pincode and a latitude/longitude pair.
 *
 * Safe to re-run: rows are upserted on the pincode primary key.
 */

const REF = process.env.SUPABASE_PROJECT_REF;
const PASSWORD = process.env.PGPASSWORD;
const FILE = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");

if (!REF || !PASSWORD || !FILE) {
  console.error(
    "Usage: SUPABASE_PROJECT_REF=<ref> PGPASSWORD=<pw> node scripts/import-pincodes.mjs <file.csv> [--dry-run]",
  );
  process.exit(1);
}

/** Header spellings seen across the published datasets. */
const FIELDS = {
  district: ["district", "districtname", "district_name", "taluk"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "long", "lon"],
  pincode: ["pincode", "pin_code", "pin", "postalcode", "postal_code"],
  state: ["statename", "state", "state_name", "circlename"],
};

const normalise = (header) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

/** Splits a CSV line, honouring quoted fields containing commas. */
function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function resolveColumns(header) {
  const seen = header.map(normalise);
  const index = {};
  for (const [field, spellings] of Object.entries(FIELDS)) {
    index[field] = seen.findIndex((name) => spellings.includes(name));
  }
  return index;
}

const client = new pg.Client({
  connectionTimeoutMillis: 20000,
  database: "postgres",
  host: `aws-0-${process.env.SUPABASE_REGION ?? "ap-south-1"}.pooler.supabase.com`,
  password: PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
  user: `postgres.${REF}`,
});

await client.connect();

const stats = { duplicate: 0, imported: 0, malformed: 0, outsideIndia: 0 };
const seenPincodes = new Set();
let columns = null;
let batch = [];

/** India's bounding box, generously drawn. Catches a transposed lat/lng pair. */
const plausible = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 6 &&
  lat <= 37.5 &&
  lng >= 68 &&
  lng <= 97.5;

async function flush() {
  if (batch.length === 0 || DRY_RUN) {
    batch = [];
    return;
  }
  // One statement per batch. `city_id` is left null so the trigger resolves it.
  const values = batch
    .map(
      (_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
    )
    .join(", ");
  await client.query(
    `insert into public.pincodes (pincode, district, state_name, latitude, longitude)
     values ${values}
     on conflict (pincode) do update set
       district = excluded.district,
       state_name = excluded.state_name,
       latitude = excluded.latitude,
       longitude = excluded.longitude`,
    batch.flat(),
  );
  batch = [];
}

const lines = createInterface({
  crlfDelay: Infinity,
  input: createReadStream(FILE, "utf8"),
});

for await (const line of lines) {
  if (!line.trim()) continue;
  const cells = splitCsvLine(line);

  if (!columns) {
    columns = resolveColumns(cells);
    const missing = ["pincode", "latitude", "longitude"].filter(
      (field) => columns[field] < 0,
    );
    if (missing.length > 0) {
      console.error(
        `Could not find ${missing.join(", ")} in the header:\n  ${cells.join(" | ")}`,
      );
      process.exit(1);
    }
    console.log(
      `columns → pincode:${columns.pincode} lat:${columns.latitude} lng:${columns.longitude}` +
        ` district:${columns.district} state:${columns.state}`,
    );
    continue;
  }

  const pincode = cells[columns.pincode]?.replace(/\D/g, "");
  const lat = Number.parseFloat(cells[columns.latitude]);
  const lng = Number.parseFloat(cells[columns.longitude]);

  if (!/^[1-9][0-9]{5}$/.test(pincode ?? "")) {
    stats.malformed += 1;
    continue;
  }
  if (!plausible(lat, lng)) {
    stats.outsideIndia += 1;
    continue;
  }
  // The published datasets have one row per post office, so a pincode repeats.
  // The first coordinate is as good as any and they are within a kilometre.
  if (seenPincodes.has(pincode)) {
    stats.duplicate += 1;
    continue;
  }
  seenPincodes.add(pincode);

  batch.push([
    pincode,
    cells[columns.district] || null,
    cells[columns.state] || null,
    lat,
    lng,
  ]);
  stats.imported += 1;

  if (batch.length >= 500) await flush();
}
await flush();

const { rows } = await client.query(
  `select count(*) total, count(city_id) with_city from public.pincodes`,
);

console.log(
  `\n${DRY_RUN ? "[dry run] " : ""}imported ${stats.imported}` +
    ` · duplicate pincodes skipped ${stats.duplicate}` +
    ` · malformed ${stats.malformed}` +
    ` · outside India ${stats.outsideIndia}`,
);
console.log(
  `pincodes table: ${rows[0].total} rows, ${rows[0].with_city} mapped to a city`,
);
if (rows[0].total !== rows[0].with_city) {
  console.log(
    "Rows without a city were inserted before the resolver trigger existed;" +
      " re-run this import to backfill them.",
  );
}

await client.end();
