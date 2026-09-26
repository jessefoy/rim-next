import type { MetadataRoute } from "next";
import { publicOrigin, publicIndexing } from "@/lib/publicMetadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: publicIndexing
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/account/", "/admin/", "/tools/", "/session/", "/login", "/join", "/update/"] }
      : { userAgent: "*", disallow: "/" },
    ...(publicIndexing ? { sitemap: new URL("/sitemap.xml", publicOrigin).href } : {}),
  };
}
