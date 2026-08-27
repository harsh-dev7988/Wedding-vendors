import type { z } from "zod";

export type FieldErrors = Record<string, string | undefined>;

export type ActionState = {
  status: "idle" | "error" | "success";
  /** Form-level message, announced via `role="alert"`. */
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so a failed submit never discards what the user typed. */
  values?: Record<string, string>;
};

export const idleState: ActionState = { status: "idle" };

/** Collect the submitted text values so the form can re-render them. */
export function formValues(formData: FormData, keys: readonly string[]) {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function succeeded(message: string): ActionState {
  return { status: "success", message };
}

export function invalid(
  message: string,
  options: { fieldErrors?: FieldErrors; values?: Record<string, string> } = {},
): ActionState {
  return { status: "error", message, ...options };
}

type DatabaseError = { code?: string; message?: string } | null;

/**
 * Turn a Postgres error into something a customer can act on.
 *
 * The database raises distinct conditions — daily cap, per-vendor cooldown,
 * ineligible review, unavailable listing — and collapsing all of them into
 * "check the fields and try again" told a rate-limited customer to edit a form
 * that was already correct. Unrecognised errors fall back to a generic string
 * so internal messages never reach the browser.
 */
export function describeDatabaseError(
  error: DatabaseError,
  fallback: string,
): string {
  if (!error) return fallback;

  const message = error.message ?? "";

  if (error.code === "P0001") {
    // The trigger writes the plan name and the allowance into the message
    // precisely so it can be shown as-is, rather than flattened to "that could
    // not be saved".
    if (message.includes("plan includes")) {
      return message;
    }
    if (message.includes("Daily enquiry limit")) {
      return "You have reached the limit of five new enquiries in 24 hours. Please try again tomorrow.";
    }
    if (message.includes("wait before sending")) {
      return "You contacted this vendor in the last 15 minutes. Please wait before sending another enquiry.";
    }
    if (message.includes("already been reviewed")) {
      return "You have already reviewed this enquiry.";
    }
    if (message.includes("application limit")) {
      return "You can manage up to three businesses from one account.";
    }
    return "That action is temporarily limited. Please try again shortly.";
  }

  if (error.code === "P0002") {
    if (message.includes("not eligible for review")) {
      return "This enquiry is not eligible for a review yet. You can review a vendor once the enquiry is completed, or 14 days after the event date.";
    }
    if (message.includes("contact is not available")) {
      return "This vendor has not published contact details yet, so the enquiry cannot be delivered.";
    }
    return "This listing is no longer available.";
  }

  if (error.code === "42501") {
    return "You need to sign in again to complete this action.";
  }

  if (error.code === "23505") {
    return "That has already been submitted.";
  }

  return fallback;
}
