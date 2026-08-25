import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayOrder = {
  amount: number;
  currency: string;
  id: string;
  status: string;
};

export function isRazorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
}

/** The key id is safe to expose to the browser; the secret never is. */
export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }
  return { keyId, keySecret };
}

/**
 * Create an order via the REST API rather than the Node SDK.
 *
 * The SDK is a stateful client built for long-lived servers; a `fetch` call is
 * a better fit for a serverless function and keeps the cold-start cost down.
 * Amounts are in paise — Razorpay rejects anything else.
 */
export async function createRazorpayOrder(input: {
  amountPaise: number;
  notes: Record<string, string>;
  receipt: string;
}): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      // Razorpay enforces receipt uniqueness, which gives us a second layer of
      // idempotency on top of our own payment row.
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Razorpay order creation failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as RazorpayOrder;
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // `timingSafeEqual` throws on length mismatch, which would itself leak a bit
  // of information, so length is compared first and the result is constant
  // regardless.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify the signature returned by Razorpay Checkout to the browser.
 *
 * Checkout hands the client `order_id`, `payment_id` and `signature`. Without
 * this check a customer could post arbitrary ids and claim a subscription.
 */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEquals(expected, input.signature);
}

/**
 * Verify a webhook body against `X-Razorpay-Signature`.
 *
 * The raw request text must be hashed — re-serialising the parsed JSON changes
 * key order and whitespace and produces a different digest.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");

  const expected = createHmac("sha256", secret)
    .update(input.rawBody)
    .digest("hex");
  return safeEquals(expected, input.signature);
}

export function formatPaise(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}
