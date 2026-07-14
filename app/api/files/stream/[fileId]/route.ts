/**
 * GET /api/files/stream/[fileId] — stream a binary file (PDF, image, audio…)
 * to an authorized member, inline. This is how members open stored files with
 * zero Google literacy: the server fetches as the service account and streams
 * through. Google-native types (Docs/Sheets/Slides) don't stream — the reader
 * and open routes handle those.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessFileDrive, filesViewer } from "@/lib/googleFiles";
import { driveApiRaw, getFile } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

/**
 * Types the browser may render inline. Everything else downloads as an
 * attachment: an SVG or HTML file served inline would execute script on
 * RIM's own origin — stored XSS via a simple upload (reviewer, session 163).
 */
function safeInline(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    /^image\/(png|jpe?g|gif|webp)$/.test(mime) ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const viewer = filesViewer(await auth());
  if (!viewer) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const { fileId } = await params;

  try {
    const file = await getFile(fileId);
    const allowed = await canAccessFileDrive(viewer.userId, viewer.roles, file.driveId);
    if (!allowed) {
      return NextResponse.json({ error: "You don't have access to this file." }, { status: 404 });
    }
    if (file.mimeType.startsWith("application/vnd.google-apps")) {
      return NextResponse.json(
        { error: "This kind of file opens in Google, not as a download." },
        { status: 400 },
      );
    }

    const upstream = await driveApiRaw(
      `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    );
    const safeName = file.name.replace(/[^\w .()\-]/g, "_");
    const mime = upstream.headers.get("content-type") ?? "application/octet-stream";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${safeInline(mime) ? "inline" : "attachment"}; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[files-stream]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't open this file. Please try again." },
      { status: 502 },
    );
  }
}
