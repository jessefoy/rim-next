import { db } from "@/lib/db";
import { verifyDownloadToken } from "@/lib/onlyoffice";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET — stream a document's office file to the OnlyOffice server.
 *
 * Token-gated, NOT session-gated: the document server fetches this
 * server-to-server using the short-lived download token RIM embedded in the
 * editor config. Streaming (rather than redirecting to the storage URL) keeps
 * the underlying blob URL server-side.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!verifyDownloadToken(token, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await db.hubDocument.findUnique({
    where: { id },
    select: { storageKey: true },
  });
  if (!doc?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upstream = await fetch(doc.storageKey);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
