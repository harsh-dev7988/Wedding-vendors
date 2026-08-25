"use client";

import Script from "next/script";
import { CreditCard } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FormAlert, StatusBanner } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";

import { confirmCheckout, startCheckout, type CheckoutState } from "./actions";

const initialState: CheckoutState = { status: "idle" };

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export function CheckoutButton({
  planCode,
  planName,
  prefillEmail,
  vendorId,
}: {
  readonly planCode: string;
  readonly planName: string;
  readonly prefillEmail?: string;
  readonly vendorId: string;
}) {
  const [state, action] = useActionState(startCheckout, initialState);
  const [scriptReady, setScriptReady] = useState(false);
  const [outcome, setOutcome] = useState<"success" | "cancelled" | null>(null);
  const opened = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const order = state.order;
    if (!order || !scriptReady || opened.current === order.orderId) return;
    if (!window.Razorpay) return;

    opened.current = order.orderId;

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: "INR",
      name: "Wedding Vendor",
      description: order.planName,
      order_id: order.orderId,
      prefill: prefillEmail ? { email: prefillEmail } : undefined,
      theme: { color: "#c9430a" },
      handler: async (response: RazorpayResponse) => {
        const payload = new FormData();
        payload.set("orderId", response.razorpay_order_id);
        payload.set("paymentId", response.razorpay_payment_id);
        payload.set("signature", response.razorpay_signature);
        await confirmCheckout(payload);
        setOutcome("success");
        // The webhook is the source of truth and may land a moment later.
        router.refresh();
      },
      modal: {
        ondismiss: () => setOutcome("cancelled"),
      },
    });

    checkout.open();
  }, [prefillEmail, router, scriptReady, state.order]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setScriptReady(true)}
        strategy="lazyOnload"
      />

      {state.status === "error" && (
        <FormAlert className="mb-4">{state.message}</FormAlert>
      )}
      {outcome === "success" && (
        <StatusBanner className="mb-4">
          Payment received. Your plan activates as soon as the payment is
          confirmed — this usually takes a few seconds.
        </StatusBanner>
      )}
      {outcome === "cancelled" && (
        <FormAlert className="mb-4">
          The payment window was closed. Nothing has been charged.
        </FormAlert>
      )}

      <form action={action}>
        <input name="planCode" type="hidden" value={planCode} />
        <input name="vendorId" type="hidden" value={vendorId} />
        <SubmitButton
          className="bg-brand-solid hover:bg-brand-solid-hover min-h-12 w-full rounded-full px-5 text-sm text-white"
          pendingLabel="Opening payment…"
        >
          <CreditCard aria-hidden="true" size={17} /> Upgrade to {planName}
        </SubmitButton>
      </form>
    </>
  );
}
