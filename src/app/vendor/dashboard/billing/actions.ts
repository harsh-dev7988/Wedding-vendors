"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  describeDatabaseError,
  invalid,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyCheckoutSignature,
} from "@/lib/payments/razorpay";
import { createClient } from "@/lib/supabase/server";

export type CheckoutState = ActionState & {
  order?: {
    amountPaise: number;
    keyId: string;
    orderId: string;
    planName: string;
    vendorName: string;
  };
};

const checkoutSchema = z.object({
  planCode: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  vendorId: z.uuid(),
});

/**
 * Creates a Razorpay order and the matching local payment row.
 *
 * The order is created first and the row second, so a provider failure leaves
 * nothing behind. The reverse order would leave orphaned "created" payments
 * whenever Razorpay is unreachable.
 */
export async function startCheckout(
  _state: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  await requireViewer("/vendor/dashboard/billing");

  if (!isRazorpayConfigured()) {
    return invalid(
      "Payments are not configured yet. Please contact support to upgrade.",
    );
  }

  const parsed = checkoutSchema.safeParse({
    planCode: formData.get("planCode"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) return invalid("That plan could not be selected.");

  const supabase = await createClient();
  const [{ data: plan }, { data: vendor }] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("code, name, price_paise")
      .eq("code", parsed.data.planCode)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("vendors")
      .select("id, business_name")
      .eq("id", parsed.data.vendorId)
      .maybeSingle(),
  ]);

  if (!plan || !vendor) return invalid("That plan is no longer available.");
  if ((plan.price_paise as number) <= 0) {
    return invalid("The free plan does not require a payment.");
  }

  let orderId: string;
  try {
    const order = await createRazorpayOrder({
      amountPaise: plan.price_paise as number,
      notes: {
        plan_code: plan.code as string,
        vendor_id: parsed.data.vendorId,
      },
      receipt: `sub_${parsed.data.vendorId.replaceAll("-", "").slice(0, 24)}`,
    });
    orderId = order.id;
  } catch (cause) {
    console.error(
      "[billing] order creation failed",
      cause instanceof Error ? cause.message : "unknown",
    );
    return invalid(
      "We could not start the payment. Please try again in a moment.",
    );
  }

  // Ownership is re-checked inside this function, so a manager or editor
  // cannot start a payment for a business they do not own.
  const { error } = await supabase.rpc("start_subscription_checkout", {
    requested_order_id: orderId,
    requested_plan_code: plan.code as string,
    requested_vendor_id: parsed.data.vendorId,
  });

  if (error) {
    return invalid(
      describeDatabaseError(
        error,
        "We could not start the payment. Please try again in a moment.",
      ),
    );
  }

  return {
    status: "idle",
    order: {
      amountPaise: plan.price_paise as number,
      keyId: getRazorpayKeyId()!,
      orderId,
      planName: plan.name as string,
      vendorName: vendor.business_name as string,
    },
  };
}

const confirmSchema = z.object({
  orderId: z.string().min(4).max(120),
  paymentId: z.string().min(4).max(120),
  signature: z.string().min(4).max(256),
});

/**
 * Confirms a payment from the browser callback.
 *
 * This is a convenience path so the vendor sees the result immediately. The
 * webhook remains the source of truth: it is signed by Razorpay, arrives
 * server-to-server, and retries. If a customer closes the tab mid-redirect the
 * webhook still settles the payment.
 */
export async function confirmCheckout(formData: FormData) {
  await requireViewer("/vendor/dashboard/billing");

  const parsed = confirmSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentId: formData.get("paymentId"),
    signature: formData.get("signature"),
  });
  if (!parsed.success) return { ok: false as const };

  // Without this the browser could post arbitrary ids and claim a plan.
  if (
    !verifyCheckoutSignature({
      orderId: parsed.data.orderId,
      paymentId: parsed.data.paymentId,
      signature: parsed.data.signature,
    })
  ) {
    console.warn("[billing] checkout signature mismatch", parsed.data.orderId);
    return { ok: false as const };
  }

  revalidatePath("/vendor/dashboard/billing");
  return { ok: true as const };
}
