import { variantPath, type ImageVariant } from "@/lib/image";

/**
 * Structural rather than importing a client type: the public, server and
 * service-role clients all satisfy this, and none of them needs to be pulled
 * into a module that only builds a URL.
 */
type StorageClient = {
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

/**
 * Resolves a `listing_media.storage_path` to the public URL of one rendition.
 *
 * Every call site used to hand back the full-size object, so a 400 px dashboard
 * thumbnail downloaded the same file as the hero image. Naming the variant at
 * the call site keeps that decision visible.
 */
export function mediaUrlResolver(
  supabase: StorageClient,
  variant: ImageVariant,
) {
  return (path: string) =>
    supabase.storage
      .from("vendor-media")
      .getPublicUrl(variantPath(path, variant)).data.publicUrl;
}
