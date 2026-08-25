import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * Re-encodes every stored listing image through the upload pipeline.
 *
 * Two jobs. First, anything uploaded before the pipeline existed went into the
 * public bucket with its EXIF intact, which for a phone photo means the GPS
 * coordinates of wherever it was taken. Second, those objects have no card or
 * thumb rendition, so every surface was serving the full-size file.
 *
 * Safe to re-run: an object that is already a `.webp` with both renditions
 * present is skipped. Pass --dry-run to see what would change.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run media:backfill
 *
 * The service-role key is required because the objects span every vendor and
 * no single session can see them all.
 */

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "vendor-media";

if (!URL_ || !KEY) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this.",
  );
  process.exit(1);
}

// Kept in step with src/lib/image.ts and src/lib/image-pipeline.ts.
const VARIANTS = { card: 800, full: 2000, thumb: 400 };
const EXT = "webp";
const MAX_INPUT_PIXELS = 50_000_000;

const variantPath = (path, variant) => {
  const suffix = `.${EXT}`;
  if (variant === "full") return path;
  if (!path.endsWith(suffix)) return path;
  return `${path.slice(0, -suffix.length)}-${variant}${suffix}`;
};

const supabase = createClient(URL_, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await supabase
  .from("listing_media")
  .select("id, storage_path")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Could not read listing_media:", error.message);
  process.exit(1);
}

if (!rows.length) {
  console.log("No listing media rows. Nothing to backfill.");
  process.exit(0);
}

console.log(`${rows.length} media row(s)${DRY_RUN ? " (dry run)" : ""}\n`);

let converted = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const source = row.storage_path;
  const alreadyWebp = source.endsWith(`.${EXT}`);

  if (alreadyWebp) {
    // Renditions are written together with the original, so one present means
    // the row has been through the pipeline.
    const { error: probeError } = await supabase.storage
      .from(BUCKET)
      .download(variantPath(source, "card"));
    if (!probeError) {
      skipped += 1;
      continue;
    }
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(source);

  if (downloadError || !blob) {
    console.error(`  fail  ${source} — ${downloadError?.message ?? "missing"}`);
    failed += 1;
    continue;
  }

  const input = Buffer.from(await blob.arrayBuffer());
  const target = alreadyWebp
    ? source
    : `${source.replace(/\.[a-z0-9]+$/i, "")}.${EXT}`;

  if (DRY_RUN) {
    console.log(`  would convert  ${source} -> ${target} (+2 renditions)`);
    converted += 1;
    continue;
  }

  try {
    for (const [variant, width] of Object.entries(VARIANTS)) {
      const bytes = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize({ fit: "inside", width, withoutEnlargement: true })
        .toColourspace("srgb")
        .webp({ effort: 4, quality: variant === "thumb" ? 72 : 82 })
        .toBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(variantPath(target, variant), bytes, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
    }
  } catch (cause) {
    console.error(`  fail  ${source} — ${cause.message}`);
    failed += 1;
    continue;
  }

  if (target !== source) {
    // Point the row at the new object before deleting the old one, so a crash
    // in between leaves a stale original rather than a broken reference.
    const { error: updateError } = await supabase
      .from("listing_media")
      .update({ storage_path: target })
      .eq("id", row.id);

    if (updateError) {
      console.error(`  fail  ${source} — ${updateError.message}`);
      failed += 1;
      continue;
    }
    await supabase.storage.from(BUCKET).remove([source]);
  }

  console.log(`  ok    ${source} -> ${target}`);
  converted += 1;
}

console.log(
  `\nconverted ${converted} · skipped ${skipped} · failed ${failed}` +
    (DRY_RUN ? "  (dry run — nothing was written)" : ""),
);
process.exit(failed > 0 ? 1 : 0);
