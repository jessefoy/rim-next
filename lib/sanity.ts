import { createClient } from "@sanity/client";

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false, // false = bypass CDN, fetch directly from API — published changes appear within the ISR window (revalidate: 60s)
});

// Helper to build image URLs from Sanity image references
export function sanityImageUrl(ref: string): string {
  if (!ref) return "";
  // ref format: image-{id}-{width}x{height}-{format}
  const [, id, dimensions, format] = ref.split("-");
  const [width, height] = dimensions?.split("x") ?? [];
  return `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${id}-${width}x${height}.${format}`;
}
