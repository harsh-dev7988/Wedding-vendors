import { type NextRequest, NextResponse } from "next/server";

import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
// Signature verification needs node:crypto and the service-role client.
export const runtime = "nodejs";

type RazorpayEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        error_description?: string;
        id?: string;
        order_id?: string;
      };
    };
  };
};

const CAPTURED_EVENTS = new Set(["payment.captured", "order.paid"]);
const FAILED_EVENTS = new Set(["payment.failed"]);

/**
 * Razorpay payment webhook.
 *
 * Three properties matter here:
 *
 * 1. **The raw body is hashed, not the parsed object.** Re-serialising JSON
 *    changes key order and whitespace and produces a different digest, so the
 *    signature would never match.
 * 2. **Nothing is trusted before the signature check.** The body is not parsed
 *    until the HMAC verifies, so an unsigned request cannot reach any logic.
 * 3. **It is idempotent.** Razorpay retries on any non-2xx and can deliver the
 *    same event more than once; `apply_razorpay_payment` returns early when the
 *    payment is already captured.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let verified = false;
  try {
    verified = verifyWebhookSignature({ rawBody, signature });
  } catch {
    // Secret not configured. 500 so Razorpay retries once it is.
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;

  // Acknowledge events we do not act on, so Razorpay stops retrying them.
  if (
    !orderId ||
    (!CAPTURED_EVENTS.has(event.event) && !FAILED_EVENTS.has(event.event))
  ) {
    return NextResponse.json({ received: true, handled: false });
  }

  const status = CAPTURED_EVENTS.has(event.event) ? "captured" : "failed";

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("apply_razorpay_payment", {
      requested_failure: entity?.error_description ?? null,
      requested_order_id: orderId,
      requested_payment_id: entity?.id ?? null,
      requested_signature: null,
      requested_status: status,
    });

    if (error) {
      // An order we do not recognise is not going to become recognisable on a
      // retry, so acknowledge it rather than looping forever.
      if (error.code === "P0002") {
        console.warn("[razorpay] unknown order", orderId);
        return NextResponse.json({ received: true, handled: false });
      }
      console.error("[razorpay] apply failed", error.message);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  } catch (cause) {
    console.error(
      "[razorpay] webhook error",
      cause instanceof Error ? cause.message : "unknown",
    );
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true, handled: true });
}
