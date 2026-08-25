"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { compressForUpload } from "@/lib/image-client";

import { uploadListingImage } from "./actions";

const KB = 1024;

function formatBytes(bytes: number) {
  return bytes >= KB * KB
    ? `${(bytes / (KB * KB)).toFixed(1)} MB`
    : `${Math.round(bytes / KB)} KB`;
}

/**
 * Adds one enhancement to the plain upload form: a picked file is shrunk in
 * the browser before it is posted. Everything else — validation, the Server
 * Action, the 5 MB cap — is unchanged, and if the shrink is unavailable or
 * unhelpful the original file is submitted exactly as before.
 */
export function ImageUploadForm({ listingId }: { readonly listingId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileId = useId();
  const altId = useId();

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setSaved(null);
    if (!file) return;

    setBusy(true);
    const compressed = await compressForUpload(file);
    setBusy(false);
    if (!compressed) return;

    // Swapping the file list is what makes the smaller file the one the form
    // posts; the Server Action sees a normal upload either way.
    const transfer = new DataTransfer();
    transfer.items.add(compressed);
    input.files = transfer.files;
    setSaved(`${formatBytes(file.size)} → ${formatBytes(compressed.size)}`);
  }

  return (
    <>
      <form
        action={uploadListingImage}
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input name="listingId" type="hidden" value={listingId} />
        <label className="grid gap-1 text-xs font-bold" htmlFor={fileId}>
          Image file
          <input
            accept="image/jpeg,image/png,image/webp"
            className="border-border min-h-11 rounded-xl border p-2 text-xs"
            id={fileId}
            name="image"
            onChange={handleFile}
            ref={fileInput}
            required
            type="file"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold" htmlFor={altId}>
          Alt text
          <input
            className="border-border min-h-11 rounded-xl border px-3 text-sm"
            id={altId}
            maxLength={240}
            minLength={5}
            name="altText"
            placeholder="Describe the image"
            required
          />
        </label>
        <SubmitButton
          className="border-border hover:border-brand-text/50 min-h-11 self-end rounded-xl border px-4 text-sm"
          disabled={busy}
          pendingLabel="Uploading…"
        >
          <Upload aria-hidden="true" size={15} /> Upload
        </SubmitButton>
      </form>
      <p aria-live="polite" className="text-muted-foreground mt-2 text-xs">
        {busy
          ? "Preparing the image…"
          : saved
            ? `Compressed for upload: ${saved}. JPEG, PNG or WebP up to 5 MB.`
            : "JPEG, PNG or WebP up to 5 MB. At least one image is required before a moderator can publish."}
      </p>
    </>
  );
}
