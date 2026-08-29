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

/**
 * Matches a column per field, in the order the spellings are listed.
 *
 * The spellings are ranked by preference, so the search has to walk them in
 * that order and ask where each sits in the header — not walk the header and
 * ask whether each column is a spelling. The India Post export has both
 * `circlename` (first column, "Telangana Circle") and `statename` (ninth,
 * "TELANGANA"); searching by header position picked the postal circle for
 * every one of 165,000 rows.
 */
function resolveColumns(header) {
  const seen = header.map(normalise);
  const index = {};
  for (const [field, spellings] of Object.entries(FIELDS)) {
    index[field] = -1;
    for (const spelling of spellings) {
      const at = seen.indexOf(spelling);
      if (at >= 0) {
        index[field] = at;
        break;
      }
    }
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

const stats = {
  duplicate: 0,
  imported: 0,
  malformed: 0,
  outlier: 0,
  outsideIndia: 0,
};
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

/**
 * Read every row before writing any, because a pincode's coordinate is only
 * trustworthy once its siblings are known.
 *
 * The published dataset has one row per post office, so a pincode repeats
 * dozens of times. Taking the first row's coordinate — which this did — hands
 * the whole pincode over to whichever post office happens to be listed first,
 * including one with a typo. Pincode 229127 is in Rae Bareli, about 450 km from
 * Delhi; its first row put it near enough to Kolkata that the nearest-city
 * trigger chose Kolkata, 1,734 km away.
 *
 * The median across a pincode's own post offices fixes that: they are genuinely
 * within a kilometre or two of each other, so a single wrong row cannot move
 * the median, while an average would be dragged by it.
 */
const byPincode = new Map();

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
        `Could not find ${missing.join(", ")} in the header:
  ${cells.join(" | ")}`,
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

  const existing = byPincode.get(pincode);
  if (existing) {
    existing.lats.push(lat);
    existing.lngs.push(lng);
    stats.duplicate += 1;
  } else {
    byPincode.set(pincode, {
      district: cells[columns.district] || null,
      lats: [lat],
      lngs: [lng],
      state: cells[columns.state] || null,
    });
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const resolved = new Map();
for (const [pincode, row] of byPincode) {
  resolved.set(pincode, {
    district: row.district,
    lat: median(row.lats),
    lng: median(row.lngs),
    state: row.state,
  });
}

/**
 * Reject a pincode that sits nowhere near the others in its sorting district.
 *
 * The first three digits are a postal sorting district, which is genuinely
 * compact — so the district's own median is a reference the dataset provides
 * about itself, with no external source needed. About 2% of pincodes are more
 * than 200 km from theirs, which no real sorting district spans, and those are
 * the rows that would otherwise attach a whole pincode to the wrong end of the
 * country.
 */
const OUTLIER_KM = 200;
const districts = new Map();
for (const [pincode, row] of resolved) {
  const key = pincode.slice(0, 3);
  const bucket = districts.get(key) ?? { lats: [], lngs: [] };
  bucket.lats.push(row.lat);
  bucket.lngs.push(row.lng);
  districts.set(key, bucket);
}
const districtCentre = new Map(
  [...districts].map(([key, bucket]) => [
    key,
    { lat: median(bucket.lats), lng: median(bucket.lngs) },
  ]),
);

const distanceKm = (a, b) => {
  const rad = Math.PI / 180;
  const h =
    0.5 -
    Math.cos((b.lat - a.lat) * rad) / 2 +
    (Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      (1 - Math.cos((b.lng - a.lng) * rad))) /
      2;
  return 12742 * Math.asin(Math.sqrt(h));
};

for (const [pincode, row] of resolved) {
  const centre = districtCentre.get(pincode.slice(0, 3));
  if (!centre) continue;
  if (distanceKm(row, centre) > OUTLIER_KM) {
    resolved.delete(pincode);
    stats.outlier += 1;
    continue;
  }
  batch.push([pincode, row.district, row.state, row.lat, row.lng]);
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
    ` · outside India ${stats.outsideIndia}` +
    ` · coordinate outliers dropped ${stats.outlier}`,
);
console.log(
  `pincodes table: ${rows[0].total} rows, ${rows[0].with_city} mapped to a city`,
);
if (rows[0].total !== rows[0].with_city) {
  const unmapped = rows[0].total - rows[0].with_city;
  console.log(
    `${unmapped} pincode(s) sit more than 200 km from every launch city, so they` +
      " carry no city. That is the resolver working, not a gap: search still" +
      " runs from the pincode's own coordinates, and claiming a pincode belongs" +
      " to a metro 800 km away would be worse than saying nothing.",
  );
}

await client.end();
