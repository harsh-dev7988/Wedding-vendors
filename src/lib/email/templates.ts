import { siteConfig } from "@/config/site";

/**
 * Plain, single-column HTML with inline styles — the only thing that renders
 * consistently across Gmail, Outlook and Indian webmail clients.
 *
 * A hard rule applies to every template here: **a notification email must never
 * contain a vendor's phone number, email address or WhatsApp number.** Email is
 * forwardable, is indexed by the recipient's provider, and is outside the
 * reveal audit trail. Templates link into the app, where the reveal is
 * authenticated and recorded.
 */
function layout(options: { body: string; heading: string; preheader: string }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff8ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#241803;">
<span style="display:none;font-size:1px;color:#fff8ee;">${escapeHtml(options.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ee;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #f1e6d2;border-radius:20px;overflow:hidden;">
<tr><td style="padding:28px 32px 0;">
<p style="margin:0;font-size:18px;font-weight:700;">Wedding<span style="color:#b83c00;">Vendor</span></p>
</td></tr>
<tr><td style="padding:20px 32px 8px;">
<h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(options.heading)}</h1>
</td></tr>
<tr><td style="padding:0 32px 28px;font-size:15px;line-height:1.65;color:#4a3d24;">
${options.body}
</td></tr>
</table>
<p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.6;color:#756542;text-align:center;">
You are receiving this because you have an account on ${escapeHtml(siteConfig.name)}.<br>
<a href="${siteConfig.url}/account/settings" style="color:#b83c00;">Manage email preferences</a>
</p>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:#c9430a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:999px;">${escapeHtml(label)}</a></p>`;
}

export type EmailContent = { html: string; subject: string; text: string };

/** Sent to the vendor when a customer submits a validated enquiry. */
export function newLeadEmail(input: {
  businessName: string;
  eventDate: string;
  guestCount: number | null;
  listingTitle: string;
}): EmailContent {
  const details = [
    `Event date: ${input.eventDate}`,
    input.guestCount ? `Approximate guests: ${input.guestCount}` : null,
    `Listing: ${input.listingTitle}`,
  ].filter(Boolean) as string[];

  return {
    subject: `New wedding enquiry for ${input.listingTitle}`,
    html: layout({
      heading: "You have a new enquiry",
      preheader: `A customer enquired about ${input.listingTitle}.`,
      body: `<p style="margin:0 0 16px;">Hello ${escapeHtml(input.businessName)},</p>
<p style="margin:0 0 16px;">A signed-in customer has sent an enquiry through the marketplace.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff8ee;border-radius:14px;padding:16px;margin:0 0 8px;">
<tr><td style="padding:16px;font-size:14px;line-height:1.8;">${details.map((line) => escapeHtml(line)).join("<br>")}</td></tr>
</table>
${button(`${siteConfig.url}/vendor/dashboard`, "Open your lead inbox")}
<p style="margin:16px 0 0;font-size:13px;color:#756542;">The customer's full message and requirements are in your dashboard. Responding quickly is the single strongest predictor of winning the booking.</p>`,
    }),
    text: `Hello ${input.businessName},\n\nA signed-in customer has sent an enquiry through the marketplace.\n\n${details.join("\n")}\n\nOpen your lead inbox: ${siteConfig.url}/vendor/dashboard\n`,
  };
}

/** Sent to the vendor when a moderator publishes, returns or suspends a listing. */
export function listingModerationEmail(input: {
  action: "publish" | "reject" | "suspend";
  listingTitle: string;
  note: string | null;
  slug: string;
}): EmailContent {
  const copy = {
    publish: {
      heading: "Your listing is live",
      subject: `${input.listingTitle} is now published`,
      body: `<p style="margin:0 0 16px;"><strong>${escapeHtml(input.listingTitle)}</strong> has passed moderation and is now visible in the marketplace.</p>`,
      cta: {
        href: `${siteConfig.url}/vendor/${input.slug}`,
        label: "View your public profile",
      },
    },
    reject: {
      heading: "Your listing needs changes",
      subject: `${input.listingTitle} was returned for changes`,
      body: `<p style="margin:0 0 16px;">A moderator has returned <strong>${escapeHtml(input.listingTitle)}</strong>. You can edit it and submit it again — nothing has been deleted.</p>`,
      cta: {
        href: `${siteConfig.url}/vendor/dashboard`,
        label: "Edit and resubmit",
      },
    },
    suspend: {
      heading: "Your listing has been suspended",
      subject: `${input.listingTitle} has been suspended`,
      body: `<p style="margin:0 0 16px;"><strong>${escapeHtml(input.listingTitle)}</strong> has been suspended and is no longer visible in the marketplace.</p>`,
      cta: {
        href: `${siteConfig.url}/contact`,
        label: "Contact the moderation team",
      },
    },
  }[input.action];

  const note = input.note
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff8ee;border-radius:14px;margin:0 0 8px;">
<tr><td style="padding:16px;font-size:14px;line-height:1.7;"><strong>Moderator note</strong><br>${escapeHtml(input.note)}</td></tr></table>`
    : "";

  return {
    subject: copy.subject,
    html: layout({
      heading: copy.heading,
      preheader: copy.subject,
      body: `${copy.body}${note}${button(copy.cta.href, copy.cta.label)}`,
    }),
    text: `${copy.heading}\n\n${input.listingTitle}\n${input.note ? `\nModerator note: ${input.note}\n` : ""}\n${copy.cta.href}\n`,
  };
}

/** Sent to the vendor when their business is approved. */
export function vendorApprovedEmail(input: {
  businessName: string;
}): EmailContent {
  return {
    subject: `${input.businessName} is approved`,
    html: layout({
      heading: "Your business is approved",
      preheader: `${input.businessName} has been verified for 12 months.`,
      body: `<p style="margin:0 0 16px;">Hello ${escapeHtml(input.businessName)},</p>
<p style="margin:0 0 16px;">Your business has passed verification. Any listing you submit can now be published by a moderator, and your profile will carry the verified badge for 12 months.</p>
${button(`${siteConfig.url}/vendor/dashboard`, "Add a listing")}`,
    }),
    text: `Hello ${input.businessName},\n\nYour business has passed verification and is approved for 12 months.\n\n${siteConfig.url}/vendor/dashboard\n`,
  };
}

/** Sent to the customer once an enquiry is complete, inviting a review. */
export function reviewRequestEmail(input: {
  listingSlug: string;
  listingTitle: string;
}): EmailContent {
  return {
    subject: `How was ${input.listingTitle}?`,
    html: layout({
      heading: `How was ${input.listingTitle}?`,
      preheader: "Your review helps other couples choose well.",
      body: `<p style="margin:0 0 16px;">You enquired with <strong>${escapeHtml(input.listingTitle)}</strong> through the marketplace. A short, honest review helps other couples decide.</p>
<p style="margin:0 0 16px;">Only customers who sent a real enquiry can review a vendor, which is what keeps these reviews worth reading.</p>
${button(`${siteConfig.url}/account`, "Write a review")}`,
    }),
    text: `How was ${input.listingTitle}?\n\nWrite a review: ${siteConfig.url}/account\n`,
  };
}

/** Sent to the vendor after a successful subscription payment. */
export function paymentReceiptEmail(input: {
  amountLabel: string;
  businessName: string;
  paymentId: string;
  periodEnd: string;
  planName: string;
}): EmailContent {
  return {
    subject: `Payment received — ${input.planName}`,
    html: layout({
      heading: "Payment received",
      preheader: `${input.amountLabel} for ${input.planName}.`,
      body: `<p style="margin:0 0 16px;">Thank you. Your subscription for <strong>${escapeHtml(input.businessName)}</strong> is active.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff8ee;border-radius:14px;margin:0 0 8px;">
<tr><td style="padding:16px;font-size:14px;line-height:1.8;">
Plan: ${escapeHtml(input.planName)}<br>
Amount: ${escapeHtml(input.amountLabel)}<br>
Renews: ${escapeHtml(input.periodEnd)}<br>
Payment reference: ${escapeHtml(input.paymentId)}
</td></tr></table>
${button(`${siteConfig.url}/vendor/dashboard/billing`, "View billing")}`,
    }),
    text: `Payment received.\n\nPlan: ${input.planName}\nAmount: ${input.amountLabel}\nRenews: ${input.periodEnd}\nReference: ${input.paymentId}\n\n${siteConfig.url}/vendor/dashboard/billing\n`,
  };
}

/**
 * Sent to the other party when a message is posted to a lead thread.
 *
 * Carries only a short preview and a link. The full thread — and the contact
 * reveal — stay behind authentication where access is recorded.
 */
export function newMessageEmail(input: {
  from: "customer" | "vendor";
  listingTitle: string;
  preview: string;
  threadUrl: string;
}): EmailContent {
  const who = input.from === "vendor" ? input.listingTitle : "A customer";
  const heading =
    input.from === "vendor"
      ? `${input.listingTitle} replied to your enquiry`
      : `New message about ${input.listingTitle}`;

  return {
    subject: heading,
    html: layout({
      heading,
      preheader: input.preview.slice(0, 90),
      body: `<p style="margin:0 0 16px;">${escapeHtml(who)} sent you a message.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff8ee;border-radius:14px;margin:0 0 8px;">
<tr><td style="padding:16px;font-size:14px;line-height:1.7;font-style:italic;">${escapeHtml(input.preview)}</td></tr></table>
${button(`${siteConfig.url}${input.threadUrl}`, "Open the conversation")}
<p style="margin:16px 0 0;font-size:13px;color:#756542;">Replies sent through the marketplace are recorded, which is what lets us show honest response times.</p>`,
    }),
    text: `${heading}

"${input.preview}"

Open the conversation: ${siteConfig.url}${input.threadUrl}
`,
  };
}
