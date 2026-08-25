import { Resend } from "resend";

/**
 * Sends one email through the same configuration the application uses, to
 * confirm the key and the verified domain actually work.
 *
 *   RESEND_API_KEY=re_... EMAIL_FROM="Wedding Vendor <hello@yourdomain>" \
 *     node scripts/email-test.mjs you@example.com
 *
 * The key is read from the environment, never hardcoded. A key committed to a
 * repository is a key that has to be rotated.
 */
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.argv[2];

if (!apiKey || !from || !to) {
  console.error(
    "Usage: RESEND_API_KEY=... EMAIL_FROM=... node scripts/email-test.mjs <recipient>",
  );
  process.exit(1);
}

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  html: `<p>If you are reading this, <strong>RESEND_API_KEY</strong> and
         <strong>EMAIL_FROM</strong> are correct and the sending domain is
         verified.</p>
         <p style="color:#756542">Sent by scripts/email-test.mjs</p>`,
  subject: "Wedding Vendor — Resend configuration check",
  text: "If you are reading this, RESEND_API_KEY and EMAIL_FROM are correct and the sending domain is verified.",
  to,
});

if (error) {
  console.error("FAILED:", error.name, "-", error.message);
  // The two failures worth naming, because the message alone is cryptic.
  if (/domain is not verified/i.test(error.message)) {
    console.error(
      "  The domain in EMAIL_FROM is not verified in Resend. Add the DNS\n" +
        "  records Resend lists, then press Verify on the Domains page.",
    );
  }
  if (/API key is invalid/i.test(error.message)) {
    console.error("  RESEND_API_KEY is wrong, revoked, or from another team.");
  }
  process.exit(1);
}

console.log("Sent. Resend message id:", data?.id);
console.log("Check the recipient inbox, and Resend -> Logs for delivery.");
