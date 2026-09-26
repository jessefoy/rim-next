import type { Metadata } from "next";

function configuredOrigin(): URL {
  try {
    const url = new URL((process.env.NEXTAUTH_URL || "https://rim-next.vercel.app").trim());
    if (url.protocol === "https:" || url.protocol === "http:") return new URL(url.origin);
  } catch { /* safe preview default */ }
  return new URL("https://rim-next.vercel.app");
}
export const publicOrigin = configuredOrigin();
export const publicIndexing = process.env.RIM_PUBLIC_INDEXING === "true"
  && process.env.VERCEL_ENV === "production"
  && ["rootedinmindfulness.org", "www.rootedinmindfulness.org"].includes(publicOrigin.hostname);

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title, description,
    alternates: { canonical: new URL(path, publicOrigin).href },
    openGraph: { title, description, url: new URL(path, publicOrigin).href, siteName: "Rooted In Mindfulness", type: "website", locale: "en_US", images: [{ url: "/images/Community-Hands-on-Tree.jpg", alt: "Community members placing their hands together on a tree" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/images/Community-Hands-on-Tree.jpg"] },
  };
}
