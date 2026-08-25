import { MessageSquare } from "lucide-react";

import { formatIndiaDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import { MessageComposer } from "./message-composer";

export type ThreadMessage = {
  readonly authorType: "customer" | "vendor" | "system";
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
};

type MessageThreadProps = {
  readonly counterpartyLabel: string;
  readonly leadId: string;
  readonly messages: readonly ThreadMessage[];
  readonly returnTo: string;
  /** Which side the signed-in viewer is on. */
  readonly viewerType: "customer" | "vendor";
  readonly disabledReason?: string;
};

export function MessageThread({
  counterpartyLabel,
  leadId,
  messages,
  returnTo,
  viewerType,
  disabledReason,
}: MessageThreadProps) {
  return (
    <section
      aria-labelledby="thread-heading"
      className="border-border shadow-soft rounded-[2rem] border bg-white p-6 md:p-7"
    >
      <div className="flex items-center gap-3">
        <MessageSquare
          aria-hidden="true"
          className="text-brand-text"
          size={20}
        />
        <h2 className="text-2xl font-bold" id="thread-heading">
          Conversation
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        Messages here are recorded, which is what lets us show honest response
        times. You can also use the contact details released with this enquiry.
      </p>

      {messages.length === 0 ? (
        <p className="border-border text-muted-foreground mt-6 rounded-2xl border border-dashed p-6 text-sm">
          No replies yet.{" "}
          {viewerType === "customer"
            ? `${counterpartyLabel} has been notified by email.`
            : "Replying quickly is the strongest predictor of winning the booking."}
        </p>
      ) : (
        <ol className="mt-6 space-y-3">
          {messages.map((message) => {
            const mine = message.authorType === viewerType;
            const system = message.authorType === "system";

            return (
              <li
                className={cn("flex", mine ? "justify-end" : "justify-start")}
                key={message.id}
              >
                <article
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                    system
                      ? "bg-muted text-muted-foreground w-full text-center"
                      : mine
                        ? "bg-brand-solid text-white"
                        : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      mine ? "text-white/75" : "text-muted-foreground",
                    )}
                  >
                    <span className="sr-only">
                      {mine ? "Sent by you" : `Sent by ${counterpartyLabel}`}{" "}
                      at{" "}
                    </span>
                    {formatIndiaDateTime(message.createdAt)}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {disabledReason ? (
        <p className="border-border text-muted-foreground mt-6 rounded-2xl border border-dashed p-4 text-sm">
          {disabledReason}
        </p>
      ) : (
        <MessageComposer
          counterpartyLabel={counterpartyLabel}
          leadId={leadId}
          returnTo={returnTo}
        />
      )}
    </section>
  );
}
