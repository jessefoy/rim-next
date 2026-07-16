/**
 * GET /api/files/stream/[fileId] — stream a binary file (PDF, image, audio…)
 * to an authorized member. This is how members open stored files with zero
 * Google literacy: the server fetches as the service account and streams
 * through. Google-native types (Docs/Sheets/Slides) don't stream — the reader
 * and open routes handle those.
 *
 * Only safe types render inline (an SVG/HTML served inline would execute
 * script on RIM's origin — stored XSS via upload); everything else downloads
 * as an attachment, always with nosniff. Range requests are passed through so
 * audio/video seeking works and long recordings aren't re-proxied whole.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeFileRead } from "@/lib/googleFiles";
import { driveApiRaw } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

/** The mime "essence" — drop any ;charset / ,second-value so a crafted
 *  "audio/mpeg, text/html" can't slip past the inline check or be reflected. */
function mimeEssence(raw: string): string {
  return raw.split(/[;,]/)[0].trim().toLowerCase();
}

/** Types the browser may render inline (checked against the essence only). */
function safeInline(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    /^image\/(png|jpe?g|gif|webp)$/.test(mime) ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    // Inside the try so a getFile network/5xx failure (via authorizeFileRead)
    // becomes the friendly 502 below, not an uncaught 500; the gate's own
    // 401/404 are returned as-is. authorizeFileRead also enforces the draft
    // gate — a held file won't stream to a non-creator even with its id.
    const gate = await authorizeFileRead(await auth(), fileId);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const { file } = gate.data;

    if (file.mimeType.startsWith("application/vnd.google-apps")) {
      return NextResponse.json(
        { error: "This kind of file opens in Google, not as a download." },
        { status: 400 },
      );
    }

    // Pass a Range header straight through so the browser can seek media and
    // resume; Google answers 206 with Content-Range, which we relay verbatim.
    const range = req.headers.get("range");
    const upstream = await driveApiRaw(
      `/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      range ? { Range: range } : undefined,
    );
    const rawType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const mime = mimeEssence(rawType);
    const safeName = file.name.replace(/[^\w .()\-]/g, "_");

    const headers = new Headers({
      // Reflect the sanitized essence, never the raw upstream string.
      "Content-Type": mime || "application/octet-stream",
      "Content-Disposition": `${safeInline(mime) ? "inline" : "attachment"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    });
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    console.error("[files-stream]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't open this file. Please try again." },
      { status: 502 },
    );
  }
}
