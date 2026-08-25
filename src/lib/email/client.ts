import "server-only";

import { Resend } from "resend";

/**
 * Resend is optional at build time and in local development: when the key is
 * absent every send becomes a logged no-op rather than a crash, so the app
 * still runs credential-free.
 */
export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function getFromAddress() {
  return process.env.EMAIL_FROM ?? "Wedding Vendor <onboarding@resend.dev>";
}

export function getReplyToAddress() {
  return process.env.EMAIL_REPLY_TO;
}
