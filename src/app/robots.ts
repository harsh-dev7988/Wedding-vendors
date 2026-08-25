import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated surfaces, and the unbounded `?category=&city=&q=` search
      // space that would otherwise be an open crawl trap.
      disallow: [
        "/account",
        "/admin",
        "/auth/",
        "/shortlist",
        "/vendor/dashboard",
        "/for-vendors/apply",
        "/vendors?",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
