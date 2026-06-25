import { redirect } from "next/navigation";

/**
 * /session/[slug] — legacy session URL. The dedicated in-browser LiveKit room
 * that used to live here was retired when sessions moved to Zoom (session 159).
 * This now forwards to the single Zoom entry point, preserving an open-access
 * guest ?key= so old bookmarks and shared guest links still work.
 */
export default async function SessionRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { slug } = await params;
  const { key } = await searchParams;
  redirect(`/session/${slug}/enter${key ? `?key=${encodeURIComponent(key)}` : ""}`);
}
