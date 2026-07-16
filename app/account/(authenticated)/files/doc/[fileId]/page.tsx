/**
 * /account/files/doc/[fileId] — legacy redirect (file-detail slice).
 *
 * The Google Doc reader was folded into the universal file detail page at
 * /account/files/[fileId]. This route stays as a redirect so old links,
 * bookmarks, and any emailed reader URLs still land in the right place.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyDocReaderRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { fileId } = await params;
  const { from } = await searchParams;
  const qs = from ? `?from=${encodeURIComponent(from)}` : "";
  redirect(`/account/files/${fileId}${qs}`);
}
