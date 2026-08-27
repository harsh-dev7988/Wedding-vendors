import { Search } from "lucide-react";

import { NearMeButton } from "@/components/marketplace/near-me-button";
import { SelectMenu } from "@/components/ui/select-menu";
import { getCities } from "@/data/cities";
import { getCategories } from "@/data/marketplace";

type DirectorySearchProps = {
  readonly city?: string;
  readonly category?: string;
  readonly query?: string;
  readonly compact?: boolean;
};

export async function DirectorySearch({
  city,
  category,
  query,
  compact = false,
}: DirectorySearchProps) {
  return (
    <form
      action="/vendors"
      aria-labelledby="directory-search-heading"
      className={`border-border shadow-soft grid gap-2 rounded-3xl border bg-white p-2 ${compact ? "lg:grid-cols-[1fr_1fr_1.2fr_auto]" : "sm:grid-cols-[1fr_1fr_1.2fr_auto]"}`}
      role="search"
    >
      <h2 className="sr-only" id="directory-search-heading">
        Search wedding vendors
      </h2>
      {/* The padding is on the trigger, not on a wrapper, so the whole field
          is clickable rather than just the value row. */}
      <div className="bg-muted/55 flex rounded-2xl">
        <SelectMenu
          caption="Category"
          className="min-h-14 px-4 py-2 text-sm font-semibold"
          label="Category"
          name="category"
          options={[
            { label: "All categories", value: "" },
            ...getCategories().map((item) => ({
              label: item.name,
              value: item.slug,
            })),
          ]}
          value={category ?? ""}
        />
      </div>
      <div className="bg-muted/55 flex rounded-2xl">
        <SelectMenu
          caption="City"
          className="min-h-14 px-4 py-2 text-sm font-semibold"
          label="City"
          name="city"
          options={[
            { label: "All metros", value: "" },
            ...(await getCities()).map((metro) => ({
              label: metro.name,
              value: metro.slug,
            })),
          ]}
          value={city ?? ""}
        />
      </div>
      <label className="bg-muted/55 flex min-h-14 flex-col justify-center rounded-2xl px-4 py-2">
        <span className="text-muted-foreground block text-[0.68rem] font-bold tracking-widest uppercase">
          Keywords
        </span>
        <input
          className="mt-1 w-full bg-transparent text-sm font-semibold placeholder:font-medium"
          defaultValue={query}
          maxLength={80}
          name="q"
          placeholder="Style, locality, service…"
          type="search"
        />
      </label>
      <button
        className="bg-brand-solid hover:bg-brand-solid-hover inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition"
        type="submit"
      >
        <Search aria-hidden="true" size={17} /> Search
      </button>
    </form>
  );
}

/** The search form plus a location shortcut, for surfaces with room for both. */
export async function DirectorySearchWithNearMe(props: DirectorySearchProps) {
  return (
    <div className="space-y-3">
      {await DirectorySearch(props)}
      <NearMeButton category={props.category} />
    </div>
  );
}
