import Link from "next/link";
import { ArrowRight, Check, Clock, Circle } from "lucide-react";

/**
 * Where a vendor is in the two-stage approval.
 *
 * The two gates are right and should stay: approving a business asks whether it
 * is real and the contact details are theirs, once; approving a listing asks
 * whether that particular offer is honest, every time. A verified caterer can
 * still post a stolen photograph.
 *
 * What was wrong was never the number of gates but that nothing showed which
 * one you were at. A vendor applied, waited, came back to a page identical to
 * the one they left, and reasonably concluded the process had swallowed them —
 * which is how the same person ended up registering a second business. A
 * two-stage flow with no status display feels broken even while it is working.
 */

export type OnboardingState = {
  readonly hasListing: boolean;
  readonly hasPublishedListing: boolean;
  readonly hasSubmittedListing: boolean;
  readonly vendorStatus: string;
};

type Step = {
  readonly detail: string;
  readonly label: string;
  readonly state: "done" | "waiting" | "todo";
  readonly action?: { readonly href: string; readonly label: string };
};

function stepsFor(state: OnboardingState): Step[] {
  const approved = state.vendorStatus === "approved";
  const suspended = state.vendorStatus === "suspended";

  return [
    {
      detail: "Your business details are with us.",
      label: "Application sent",
      state: "done",
    },
    {
      detail: suspended
        ? "This business is suspended. Contact support to resolve it."
        : approved
          ? "A moderator confirmed the business and its contact details."
          : "A moderator is checking the business is real and the contact details belong to it. This happens once.",
      label: "Business verified",
      state: suspended ? "todo" : approved ? "done" : "waiting",
    },
    {
      action:
        approved && !state.hasListing
          ? { href: "/vendor/dashboard/listings", label: "Add your listing" }
          : undefined,
      detail: state.hasListing
        ? "Your listing is written."
        : "Add what you offer, your prices and at least one photograph.",
      label: "Listing created",
      state: state.hasListing ? "done" : "todo",
    },
    {
      action:
        state.hasListing && !state.hasSubmittedListing
          ? { href: "/vendor/dashboard/listings", label: "Submit for review" }
          : undefined,
      detail: state.hasPublishedListing
        ? "Customers can find you and send enquiries."
        : state.hasSubmittedListing
          ? "A moderator is reviewing the listing itself. Only its content is checked this time."
          : "Submit the listing when it is ready.",
      label: "Listing published",
      state: state.hasPublishedListing
        ? "done"
        : state.hasSubmittedListing
          ? "waiting"
          : "todo",
    },
  ];
}

export function OnboardingProgress({
  state,
}: {
  readonly state: OnboardingState;
}) {
  const steps = stepsFor(state);
  // Once everything is live this is just clutter on a page they use daily.
  if (steps.every((step) => step.state === "done")) return null;

  const done = steps.filter((step) => step.state === "done").length;

  return (
    <section
      aria-labelledby="onboarding-heading"
      className="border-border shadow-soft mt-8 rounded-[2rem] border bg-white p-6 md:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="type-heading" id="onboarding-heading">
          Getting you live
        </h2>
        <p className="text-muted-foreground text-sm font-bold">
          Step {Math.min(done + 1, steps.length)} of {steps.length}
        </p>
      </div>

      <ol className="mt-6 grid gap-4">
        {steps.map((step) => (
          <li className="flex items-start gap-3.5" key={step.label}>
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                step.state === "done"
                  ? "bg-brand-solid text-white"
                  : step.state === "waiting"
                    ? "bg-brand-soft text-brand-text"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step.state === "done" ? (
                <Check size={15} />
              ) : step.state === "waiting" ? (
                <Clock size={15} />
              ) : (
                <Circle size={11} />
              )}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{step.label}</span>
                {step.state === "waiting" && (
                  <span className="bg-brand-soft text-brand-text rounded-full px-2 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase">
                    In review
                  </span>
                )}
              </span>
              <span className="text-muted-foreground mt-1 block text-sm leading-6">
                {step.detail}
              </span>
              {step.action && (
                <Link
                  className="text-brand-text mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold"
                  href={step.action.href}
                >
                  {step.action.label}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
