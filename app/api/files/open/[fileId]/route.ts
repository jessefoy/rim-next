/**
 * GET /api/files/open/[fileId] — the link-as-key hand-off.
 *
 * RIM is the gate: after verifying the viewer can reach this file's drive,
 * the route ensures the anyone-with-link permission exists (minting it
 * just-in-time so files created directly in Drive work too), records the
 * hand-off in RIM's audit log, and redirects into Google's own UI — the real
 * editor for Docs/Sheets/Slides, the preview for everything else.
 *
 * Because minting is a state-changing side effect on a GET, the route refuses
 * cross-site requests (Sec-Fetch-Site): SameSite=Lax would otherwise let a
 * member be lured into minting a public edit link by clicking a crafted link.
 * Our own client opens this via window.open (same-origin); a hand-typed URL
 * is "none". Only "cross-site" is rejected.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeFileRequest, logFileAction } from "@/lib/googleFiles";
import { GOOGLE_MIME, ensureAnyoneWithLinkEditor } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  }
  const { fileId } = await params;

  try {
    // Inside the try so a getFile network/5xx failure (via authorizeFileRequest)
    // becomes the friendly 502 below, not an uncaught 500; the gate's own
    // 401/404 are returned as-is.
    const gate = await authorizeFileRequest(await auth(), fileId);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const { viewer, file, place } = gate.data;

    // Google doesn't support anyone-with-link on Shared Drive folders, and a
    // folder has no meaningful "open in Google" destination for members.
    if (file.mimeType === GOOGLE_MIME.folder) {
      return NextResponse.json({ error: "Folders open inside RIM." }, { status: 400 });
    }
    if (!file.webViewLink) {
      return NextResponse.json(
        { error: "This file doesn't have an open-in-Google link." },
        { status: 502 },
      );
    }

    const minted = await ensureAnyoneWithLinkEditor(fileId);
    // Log the security-relevant first-mint distinctly from a routine open, and
    // attribute it to the origin hub (null for Community) so the audit trail
    // can answer "when did this file first become link-editable, and where."
    await logFileAction({
      userId: viewer.userId,
      action: minted ? "mint-link" : "open",
      googleFileId: fileId,
      hubId: place.hubId,
      detail: { place: place.key, mimeType: file.mimeType },
    });
    return NextResponse.redirect(file.webViewLink);
  } catch (e) {
    console.error("[files-open]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't open this file. Please try again." },
      { status: 502 },
    );
  }
}
