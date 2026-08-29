"use client";

import { Plus, Save } from "lucide-react";
import dynamic from "next/dynamic";
import { useActionState, useState } from "react";

import { FieldError, FormAlert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-result";
import { DEFAULT_SERVICE_RADIUS_M, isFixedLocationCategory } from "@/lib/geo";
import type { PickedLocation } from "@/components/maps/location-picker";

/**
 * The Google Maps SDK is roughly 200 KB and is only ever needed here, on a
 * signed-in dashboard page. `ssr: false` because it touches `window` on load.
 */
const LocationPicker = dynamic(
  () =>
    import("@/components/maps/location-picker").then((m) => m.LocationPicker),
  {
    loading: () => (
      <div className="bg-muted h-96 w-full animate-pulse rounded-2xl" />
    ),
    ssr: false,
  },
);

import { createListing, updateListing } from "./actions";

type Option = {
  /**
   * Which price units this category may use. A caterer should not be offered
   * "rental" and a jeweller should not be offered "per plate"; a single global
   * list is how a form ends up describing a shop as a service.
   */
  readonly allowedPriceUnits?: readonly string[];
  /** Heading this option sits under. Absent for an ungrouped list. */
  readonly group?: string;
  readonly slug: string;
  readonly name: string;
};
type VendorOption = { readonly id: string; readonly business_name: string };

export type ListingDefaults = {
  readonly categorySlug?: string;
  readonly citySlug?: string;
  readonly description?: string;
  readonly id?: string;
  readonly locality?: string;
  readonly priceFrom?: string;
  readonly latitude?: string;
  readonly longitude?: string;
  readonly priceUnit?: string;
  readonly serviceRadiusKm?: string;
  readonly streetAddress?: string;
  readonly summary?: string;
  readonly title?: string;
  readonly vendorId?: string;
  readonly yearsExperience?: string;
};

const PRICE_UNITS = [
  { label: "On request", value: "on_request" },
  { label: "Per plate", value: "per_plate" },
  { label: "Per person", value: "per_person" },
  { label: "Per event", value: "per_event" },
  { label: "Per function", value: "per_function" },
  { label: "Per day", value: "per_day" },
  { label: "Per piece", value: "per_piece" },
  { label: "Per kilogram", value: "per_kg" },
  { label: "Rental", value: "rental" },
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

  const initialLat = Number(defaults?.latitude);
  const initialLng = Number(defaults?.longitude);
  const [location, setLocation] = useState<PickedLocation | null>(
    Number.isFinite(initialLat) &&
      Number.isFinite(initialLng) &&
      defaults?.latitude
      ? {
          lat: initialLat,
          lng: initialLng,
          locality: defaults?.locality ?? "",
          streetAddress: defaults?.streetAddress ?? "",
        }
      : null,
  );
  // Tracked so the service-radius field can disappear for a venue, which is a
  // fixed place and has no radius.
  const [categorySlug, setCategorySlug] = useState(
    defaults?.categorySlug ?? categories[0]?.slug ?? "",
  );
  const [locality, setLocality] = useState(defaults?.locality ?? "");
  const [citySlug, setCitySlug] = useState(
    defaults?.citySlug ?? cities[0]?.slug ?? "",
  );
  // Set when the address resolves to a different city than the one showing, so
  // the vendor is told rather than silently overridden.
  const [cityChangedTo, setCityChangedTo] = useState<string | null>(null);
  const fixedLocation = isFixedLocationCategory(categorySlug);

  // Preserves the order the options arrive in, so the groups follow the
  // taxonomy's own ordering rather than being re-sorted alphabetically here.
  const categoryGroups = Array.from(
    categories.reduce((groups, option) => {
      const key = option.group ?? "";
      const existing = groups.get(key);
      if (existing) existing.push(option);
      else groups.set(key, [option]);
      return groups;
    }, new Map<string, Option[]>()),
  );

  // Narrowed to what the chosen category actually prices in. A category with
  // no list configured keeps every unit rather than losing them all — an empty
  // dropdown is a worse failure than an over-generous one.
  const allowed = categories.find(
    (option) => option.slug === categorySlug,
  )?.allowedPriceUnits;
  const priceUnits = allowed?.length
    ? PRICE_UNITS.filter((unit) => allowed.includes(unit.value))
    : PRICE_UNITS;
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
        className={`grid gap-1.5 text-sm font-bold ${vendors.length > 1 ? "" : "sr-only"}`}
        htmlFor={`${prefix}-vendorId`}
      >
        Business
        <select
          className="border-border select-field min-h-12 rounded-xl border px-3 font-medium"
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
            className="border-border select-field min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("categorySlug")}
            id={`${prefix}-categorySlug`}
            name="categorySlug"
            onChange={(event) => setCategorySlug(event.currentTarget.value)}
            required
          >
            {/* Grouped, because the list is thirty-two long. A vendor
                scanning a flat list of that size picks the wrong category, and
                a wrong category is a listing filed in a directory nobody
                looking for it will open. */}
            {categoryGroups.map(([group, options]) =>
              group ? (
                <optgroup key={group} label={group}>
                  {options.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                options.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))
              ),
            )}
          </select>
        </label>
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-citySlug`}
        >
          Primary city
          <select
            className="border-border select-field min-h-12 rounded-xl border px-3 font-medium"
            id={`${prefix}-citySlug`}
            name="citySlug"
            onChange={(event) => {
              setCitySlug(event.currentTarget.value);
              setCityChangedTo(null);
            }}
            required
            value={citySlug}
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

      <fieldset className="grid gap-3">
        <legend className="text-sm font-bold">Where you are based</legend>

        {/* The picker owns the coordinates; these carry them to the action. */}
        <input name="latitude" type="hidden" value={location?.lat ?? ""} />
        <input name="longitude" type="hidden" value={location?.lng ?? ""} />
        <input
          name="streetAddress"
          type="hidden"
          value={location?.streetAddress ?? ""}
        />

        <LocationPicker
          defaultValue={location}
          onChange={(next) => {
            setLocation(next);
            // Prefill the public label, still editable — the geocoder
            // sometimes returns a ward name where the vendor would write a
            // landmark.
            if (next?.locality) setLocality(next.locality);

            // The address already answers "which city", so asking again is a
            // question the vendor has to get right twice. Set it from the
            // address and say so; they can still override.
            if (next?.citySlug && next.citySlug !== citySlug) {
              const matched = cities.find(
                (city) => city.slug === next.citySlug,
              );
              if (matched) {
                setCitySlug(matched.slug);
                setCityChangedTo(matched.name);
              }
            }
          }}
        />

        {cityChangedTo && (
          <p className="text-brand-text text-xs font-semibold">
            City set to {cityChangedTo} from your address. Change it above if
            that is wrong.
          </p>
        )}

        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor={`${prefix}-locality`}
        >
          Neighbourhood shown to customers
          <input
            className="border-border min-h-12 rounded-xl border px-3 font-medium"
            id={`${prefix}-locality`}
            maxLength={120}
            name="locality"
            onChange={(event) => setLocality(event.currentTarget.value)}
            placeholder="e.g. Vasant Kunj"
            value={locality}
          />
          <span className="text-muted-foreground text-xs">
            This is the only part of your address customers ever see.
          </span>
        </label>

        {fixedLocation ? (
          <p className="text-muted-foreground text-xs leading-5">
            Venues are a fixed location, so there is no travel radius —
            customers come to you.
          </p>
        ) : (
          <label
            className="grid gap-1.5 text-sm font-bold"
            htmlFor={`${prefix}-serviceRadiusKm`}
          >
            How far will you travel?
            <div className="flex items-center gap-2">
              <input
                className="border-border min-h-12 w-28 rounded-xl border px-3 font-medium"
                defaultValue={
                  value("serviceRadiusKm") ||
                  String(DEFAULT_SERVICE_RADIUS_M / 1000)
                }
                id={`${prefix}-serviceRadiusKm`}
                inputMode="numeric"
                max={200}
                min={1}
                name="serviceRadiusKm"
                type="number"
              />
              <span className="text-muted-foreground text-sm font-medium">
                km from your base
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              Customers searching inside this radius will find you.
            </span>
          </label>
        )}
      </fieldset>

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
            className="border-border select-field min-h-12 rounded-xl border px-3 font-medium"
            defaultValue={value("priceUnit") || "on_request"}
            id={`${prefix}-priceUnit`}
            name="priceUnit"
          >
            {priceUnits.map((unit) => (
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
