import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/siteUrl";

/**
 * robots.txt for rootedinmindfulness.org (the integration follow-up brief, F6).
 * The public pages are open to crawlers; the member area, administration, the
 * tools, the API and the session and sign-in routes are not. The
 * rim-next.vercel.app host keeps its own X-Robots-Tag: noindex header
 * (vercel.json), which applies whatever this file says.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account/",
          "/admin/",
          "/tools/",
          "/api/",
          "/session/",
          "/update/",
          "/login",
          "/lessons/",
          "/programs/*/register",
          "/programs/*/thank-you",
          "/style-guide",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
