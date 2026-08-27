import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
const isDev = process.env.NODE_ENV !== "production";

// Applied to every route. `frame-ancestors 'none'` matters most for
// /account/enquiries/[id], the only page that renders a revealed vendor
// contact; `strict-origin-when-cross-origin` stops that URL leaking to
// wa.me when the customer taps the WhatsApp link.
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inlines its bootstrap and flight payload scripts. Razorpay
      // Checkout is loaded from its own origin and renders in an iframe.
      //
      // `unsafe-eval` is development-only: React's dev build uses eval() to
      // rebuild callstacks across the server/client boundary, and the dev
      // overlay will not render without it. It is never emitted in production
      // — React does not use eval() there.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://maps.googleapis.com`,
      // Google Maps injects its own stylesheet and icon font at runtime.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `img-src 'self' data: blob: https://*.razorpay.com https://*.googleapis.com https://*.gstatic.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' https://*.razorpay.com https://maps.googleapis.com${isDev ? " ws: http://localhost:*" : ""}${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}` : ""}`,
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "form-action 'self' https://api.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    // Next 16 only honours a `quality` prop whose value is listed here; an
    // unlisted one silently falls back to 75. The hero sources were generated
    // at 82 and were being re-encoded down.
    qualities: [75, 82],
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/vendor-media/**", supabaseUrl)]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
