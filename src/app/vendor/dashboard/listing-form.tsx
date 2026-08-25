"use client";

import { Plus, Save } from "lucide-react";
import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";

import { createListing, updateListing } from "./actions";

type Option = { readonly slug: string; readonly name: string };
type VendorOption = { readonly id: string; readonly business_name: string };

export type ListingDefaults = {
  readonly categorySlug?: string;
  readonly citySlug?: string;
  readonly description?: string;
  readonly id?: string;
  readonly locality?: string;
  readonly priceFrom?: string;
  readonly priceUnit?: string;
  readonly summary?: string;
  readonly title?: string;
  readonly vendorId?: string;
  readonly yearsExperience?: string;
};

const PRICE_UNITS = [
  { label: "On request", value: "on_request" },
  { label: "Per plate", value: "per_plate" },
  { label: "Per event", value: "per_event" },
  { label: "Per function", value: "per_function" },
  { label: "Per day", value: "per_day" },
  { label: "Package", value: "package" },
] as const;

export function ListingForm({
  categories,
  cities,
  defaults,
  mode,
  vendors,
}: {
  readonly categories: readonly Option[];
  readonly cities: readonly Option[];
  readonly defaults?: ListingDefaults;
  readonly mode: "create" | "edit";
  readonly vendors: readonly VendorOption[];
}) {
  const [state, action] = useActionState(
    mode === "create" ? createListing : updateListing,
    idleState,
  );
  const errors = state.fieldErrors ?? {};
  const prefix = defaults?.id ?? "new";
  const value = (key: keyof ListingDefaults) =>
    state.values?.[key] ?? defaults?.[key] ?? "";

  return (
    <form
      action={action}
      className="border-border shadow-soft space-y-4 rounded-[2rem] border bg-white p-6"
    >
      {defaults?.id && (
        <input name="listingId" type="hidden" value={defaults.id} />
      )}

      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <label
        className="grid gap-1.5 text-sm font-bold"
        htmlFor={`${prefix}-vendorId`}
      >
        Business
        <select
          className="border-border min-h-12 rounded-xl border px-3 font-medium"
          defaultValue={value("vendorId")}
          disabled={mode === "edit"}
          id={`${prefix}-vendorId`}
          name="vendorId"
          required
        >
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.business_name}
            </option>
          ))}
        </select>
        {mode === "edit" && (
          <input name="vendorId" type="hidden" value={value("vendorId")} />
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-categorySlug`}
        >
          Category
          <select
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("categorySlug")}
            id={`${prefix}-categorySlug`}
            name="categorySlug"
            required
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-citySlug`}
        >
          Primary city
          <select
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("citySlug")}
            id={`${prefix}-citySlug`}
            name="citySlug"
            required
          >
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        className="grid gap-1.5 text-sm font-bold"
        htmlFor={`${prefix}-title`}
      >
        Listing title
        <input
          aria-describedby={errors.title ? `${prefix}-title-error` : undefined}
          aria-invalid={errors.title ? true : undefined}
          className="border-border min-h-12 rounded-xl border px-3 font-medium"
          defaultValue={value("title")}
          id={`${prefix}-title`}
          maxLength={160}
          name="title"
          required
        />
        <FieldError id={`${prefix}-title-error`} message={errors.title} />
      </label>

      <label
        className="grid gap-1.5 text-sm font-bold"
        htmlFor={`${prefix}-locality`}
      >
        Locality{" "}
        <span className="text-muted-foreground font-medium">Optional</span>
        <input
          className="border-border min-h-12 rounded-xl border px-3 font-medium"
          defaultValue={value("locality")}
          id={`${prefix}-locality`}
          maxLength={120}
          name="locality"
        />
      </label>

      <label
        className="grid gap-1.5 text-sm font-bold"
        htmlFor={`${prefix}-summary`}
      >
        Short summary
        <textarea
          aria-describedby={`${prefix}-summary-hint${errors.summary ? ` ${prefix}-summary-error` : ""}`}
          aria-invalid={errors.summary ? true : undefined}
          className="border-border min-h-24 rounded-xl border p-3 font-medium"
          defaultValue={value("summary")}
          id={`${prefix}-summary`}
          maxLength={320}
          minLength={20}
          name="summary"
          required
        />
        <span
          className="text-muted-foreground text-xs"
          id={`${prefix}-summary-hint`}
        >
          20–320 characters. This is the line shown on directory cards.
        </span>
        <FieldError id={`${prefix}-summary-error`} message={errors.summary} />
      </label>

      <label
        className="grid gap-1.5 text-sm font-bold"
        htmlFor={`${prefix}-description`}
      >
        Full description
        <textarea
          aria-describedby={`${prefix}-description-hint${errors.description ? ` ${prefix}-description-error` : ""}`}
          aria-invalid={errors.description ? true : undefined}
          className="border-border min-h-36 rounded-xl border p-3 font-medium"
          defaultValue={value("description")}
          id={`${prefix}-description`}
          maxLength={10000}
          minLength={50}
          name="description"
          required
        />
        <span
          className="text-muted-foreground text-xs"
          id={`${prefix}-description-hint`}
        >
          50–10,000 characters.
        </span>
        <FieldError
          id={`${prefix}-description-error`}
          message={errors.description}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-priceFrom`}
        >
          Starting price ₹
          <input
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("priceFrom")}
            id={`${prefix}-priceFrom`}
            inputMode="numeric"
            min={0}
            name="priceFrom"
            type="number"
          />
        </label>
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-priceUnit`}
        >
          Price unit
          <select
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("priceUnit") || "on_request"}
            id={`${prefix}-priceUnit`}
            name="priceUnit"
          >
            {PRICE_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-yearsExperience`}
        >
          Years active
          <input
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("yearsExperience")}
            id={`${prefix}-yearsExperience`}
            inputMode="numeric"
            max={100}
            min={0}
            name="yearsExperience"
            type="number"
          />
        </label>
      </div>

      <SubmitButton
        className="bg-foreground hover:bg-brand-solid-hover min-h-12 w-full rounded-xl px-5 text-white"
        pendingLabel={mode === "create" ? "Saving draft…" : "Saving changes…"}
      >
        {mode === "create" ? (
          <>
            <Plus aria-hidden="true" size={17} /> Save draft
          </>
        ) : (
          <>
            <Save aria-hidden="true" size={17} /> Save changes
          </>
        )}
      </SubmitButton>
      {mode === "edit" && (
        <p className="text-muted-foreground text-xs">
          Saving returns this listing to draft so the change passes moderation
          before it appears publicly.
        </p>
      )}
    </form>
  );
}
