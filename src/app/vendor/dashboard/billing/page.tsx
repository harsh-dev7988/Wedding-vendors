import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, CreditCard, Receipt } from "lucide-react";

import { StatusBanner } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/datetime";
import { formatPaise, isRazorpayConfigured } from "@/lib/payments/razorpay";
import { createClient } from "@/lib/supabase/server";

import { CheckoutButton } from "./checkout-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

type Plan = {
  code: string;
  description: string | null;
  features: string[];
  id: string;
  interval_months: number;
  name: string;
  price_paise: number;
};

type Subscription = {
  current_period_end: string | null;
  plan_id: string;
  status: string;
};

type Payment = {
  amount_paise: number;
  captured_at: string | null;
  created_at: string;
  id: string;
  razorpay_order_id: string;
  status: string;
};

export default async function BillingPage({
  searchParams,
}: PageProps<"/vendor/dashboard/billing">) {
  const viewer = await requireViewer("/vendor/dashboard/billing");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("vendor_members")
    .select("vendor_id, role")
    .eq("user_id", viewer.id)
    .in("role", ["owner", "manager"]);

  const vendorIds = (memberships ?? []).map((row) => row.vendor_id as string);
  const ownerVendorIds = (memberships ?? [])
    .filter((row) => row.role === "owner")
    .map((row) => row.vendor_id as string);

  if (vendorIds.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 md:px-8" id="main-content">
        <h1 className="type-title">Billing</h1>
        <p className="text-muted-foreground mt-4 leading-7">
          Only a business owner or manager can view billing. If you manage a
          business here, ask the owner to add you.
        </p>
        <Link
          className="text-brand-text mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
          href="/vendor/dashboard"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Back to the dashboard
        </Link>
      </main>
    );
  }

  const [
    { data: vendorRows },
    { data: planRows },
    { data: subRows },
    { data: paymentRows },
  ] = await Promise.all([
    supabase.from("vendors").select("id, business_name").in("id", vendorIds),
    supabase
      .from("subscription_plans")
      .select(
        "id, code, name, description, price_paise, interval_months, features",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("vendor_subscriptions")
      .select("vendor_id, plan_id, status, current_period_end")
      .in("vendor_id", vendorIds)
      .in("status", ["active", "past_due", "pending"]),
    supabase
      .from("payments")
      .select(
        "id, amount_paise, status, razorpay_order_id, captured_at, created_at",
      )
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const vendors = (vendorRows ?? []) as Array<{
    business_name: string;
    id: string;
  }>;
  const plans = (planRows ?? []) as unknown as Plan[];
  const subsByVendor = new Map(
    (
      (subRows ?? []) as unknown as Array<Subscription & { vendor_id: string }>
    ).map((row) => [row.vendor_id, row]),
  );
  const payments = (paymentRows ?? []) as unknown as Payment[];
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  // The requested business, if it is genuinely one of theirs. An unknown or
  // someone else's id falls back to the first rather than erroring: the id is
  // in a URL, and a hand-edited URL should not be able to probe for one.
  const requested = (await searchParams).business;
  const requestedId = Array.isArray(requested) ? requested[0] : requested;
  const selected =
    vendors.find((vendor) => vendor.id === requestedId) ?? vendors[0];

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:px-8" id="main-content">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        href="/vendor/dashboard"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to the dashboard
      </Link>

      <p className="text-brand-text eyebrow mt-6">Billing</p>
      <h1 className="type-display mt-2">Plans and payments</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
        Every business starts on the free plan and can receive enquiries without
        paying. Pro adds reach and performance data. Payments are processed by
        Razorpay; card details never reach this application.
      </p>

      {!isRazorpayConfigured() && (
        <StatusBanner className="mt-7">
          Payments are not connected in this environment, so upgrade buttons are
          disabled. The free plan is fully functional.
        </StatusBanner>
      )}

      {/* One business at a time.
          Rendering every business stacked, each with its own plan block and its
          own upgrade buttons, is what made a second business read as a billing
          bug: the page looked like it was charging twice for one thing. A
          subscription belongs to a business — two real businesses genuinely do
          pay twice — so the fix is to show one at a time and say which.

          A link rather than a client control: it works without JavaScript, the
          selection survives a reload, and the page is already dynamic. */}
      {vendors.length > 1 && (
        <nav aria-label="Choose a business" className="mt-9">
          <ul className="flex flex-wrap gap-2">
            {vendors.map((vendor) => {
              const active = vendor.id === selected.id;
              return (
                <li key={vendor.id}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition ${
                      active
                        ? "border-brand-solid bg-brand-soft text-brand-text"
                        : "border-border text-muted-foreground hover:text-foreground bg-white"
                    }`}
                    href={`/vendor/dashboard/billing?business=${vendor.id}`}
                  >
                    {vendor.business_name}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            Each business carries its own plan. You are viewing{" "}
            <strong className="text-foreground">
              {selected.business_name}
            </strong>
            .
          </p>
        </nav>
      )}

      {[selected].map((vendor) => {
        const subscription = subsByVendor.get(vendor.id);
        const currentPlan = subscription
          ? planById.get(subscription.plan_id)
          : undefined;
        const isOwner = ownerVendorIds.includes(vendor.id);

        return (
          <section
            aria-labelledby={`billing-${vendor.id}`}
            className="mt-12"
            key={vendor.id}
          >
            <h2 className="type-heading" id={`billing-${vendor.id}`}>
              {vendor.business_name}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Current plan:{" "}
              <strong className="text-foreground">
                {currentPlan?.name ?? "Free listing"}
              </strong>
              {subscription?.current_period_end
                ? ` · renews ${formatIndiaDateTime(subscription.current_period_end)}`
                : ""}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = currentPlan?.id === plan.id;
                const isFree = plan.price_paise === 0;

                return (
                  <article
                    className={`rounded-3xl border p-6 ${isCurrent ? "border-brand-text/40 bg-brand-soft/40" : "border-border bg-white"}`}
                    key={plan.id}
                  >
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="mt-2 text-3xl font-bold">
                      {isFree ? "Free" : formatPaise(plan.price_paise)}
                      {!isFree && (
                        <span className="text-muted-foreground text-sm font-medium">
                          {plan.interval_months === 1 ? " / month" : " / year"}
                        </span>
                      )}
                    </p>
                    {plan.description && (
                      <p className="text-muted-foreground mt-3 text-sm leading-6">
                        {plan.description}
                      </p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li className="flex items-start gap-2" key={feature}>
                          <Check
                            aria-hidden="true"
                            className="text-success mt-0.5 shrink-0"
                            size={15}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6">
                      {isCurrent ? (
                        <p className="border-border text-muted-foreground rounded-full border border-dashed px-4 py-2.5 text-center text-sm font-bold">
                          Current plan
                        </p>
                      ) : isFree ? (
                        <p className="text-muted-foreground text-center text-sm">
                          Included by default
                        </p>
                      ) : !isOwner ? (
                        <p className="text-muted-foreground text-center text-sm">
                          Only the owner can upgrade
                        </p>
                      ) : !isRazorpayConfigured() ? (
                        <p className="border-border text-muted-foreground rounded-full border border-dashed px-4 py-2.5 text-center text-sm font-bold">
                          Payments not connected
                        </p>
                      ) : (
                        <CheckoutButton
                          planCode={plan.code}
                          planName={plan.name}
                          prefillEmail={viewer.email}
                          vendorId={vendor.id}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="payment-history" className="mt-14">
        <div className="flex items-center gap-3">
          <Receipt aria-hidden="true" className="text-brand-text" />
          <h2 className="type-heading" id="payment-history">
            Payment history
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="border-border text-muted-foreground mt-5 rounded-3xl border border-dashed p-8 text-sm">
            No payments yet.
          </p>
        ) : (
          <div className="border-border mt-5 overflow-x-auto rounded-3xl border">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                Payments made for your businesses
              </caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-bold" scope="col">
                    Date
                  </th>
                  <th className="px-4 py-3 font-bold" scope="col">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-bold" scope="col">
                    Status
                  </th>
                  <th className="px-4 py-3 font-bold" scope="col">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr className="border-border border-t" key={payment.id}>
                    <td className="px-4 py-3">
                      {formatIndiaDateTime(
                        payment.captured_at ?? payment.created_at,
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {formatPaise(payment.amount_paise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          payment.status === "captured"
                            ? "text-success font-bold"
                            : payment.status === "failed"
                              ? "text-brand-text font-bold"
                              : "text-muted-foreground"
                        }
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {payment.razorpay_order_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs leading-5">
          <CreditCard
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={14}
          />
          Card and UPI details are handled entirely by Razorpay. This
          application stores only the order reference, the amount and the
          status.
        </p>
      </section>
    </main>
  );
}
