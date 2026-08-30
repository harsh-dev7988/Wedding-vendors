import { Search } from "lucide-react";

import { NearMeButton } from "@/components/marketplace/near-me-button";
import { SelectMenu } from "@/components/ui/select-menu";
import { getCities } from "@/data/cities";
import { getCategories } from "@/data/categories";

type DirectorySearchProps = {
  /** Omit the category field where the section already fixes it. */
  readonly hideCategory?: boolean;
  /** Where the form posts. Venues search their own section. */
  readonly action?: string;
  readonly city?: string;
  readonly category?: string;
  readonly query?: string;
  readonly compact?: boolean;
};

export async function DirectorySearch({
  action = "/vendors",
  city,
  category,
  query,
  compact = false,
  hideCategory = false,
}: DirectorySearchProps) {
  // One column fewer when the section fixes the category, so the remaining
  // fields fill the bar instead of leaving a gap where a control used to be.
  // Written out in full rather than interpolated: Tailwind generates classes by
  // scanning source for literal strings, so a name built from a template
  // literal produces no CSS at all and the grid silently collapses to one
  // column — a bug that type-checks, builds, and only shows up on screen.
  const columns = hideCategory
    ? compact
      ? "lg:grid-cols-[1fr_1.2fr_auto]"
      : "sm:grid-cols-[1fr_1.2fr_auto]"
    : compact
      ? "lg:grid-cols-[1fr_1fr_1.2fr_auto]"
      : "sm:grid-cols-[1fr_1fr_1.2fr_auto]";

  return (
    <form
      action={action}
      aria-labelledby="directory-search-heading"
      // `text-foreground` explicitly, not by inheritance. This form now sits on
      // a dark band as well as on ivory, and a section that sets `text-white`
      // cascaded straight into fields that are white — the category and city
      // values rendered white on white and simply were not there. A control
      // with its own background has to own its foreground too.
      className={`border-border shadow-soft text-foreground grid gap-2 rounded-3xl border bg-white p-2 ${columns}`}
      role="search"
    >
      <h2 className="sr-only" id="directory-search-heading">
        Search wedding vendors
      </h2>
      {/* The padding is on the trigger, not on a wrapper, so the whole field
          is clickable rather than just the value row. */}
      <div
        className={`bg-muted/55 flex rounded-2xl ${hideCategory ? "hidden" : ""}`}
      >
        <SelectMenu
          caption="Category"
          className="min-h-14 px-4 py-2 text-sm font-semibold"
          label="Category"
          name="category"
          options={[
            { label: "All categories", value: "" },
            ...(await getCategories()).map((item) => ({
              group: item.groupName,
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
