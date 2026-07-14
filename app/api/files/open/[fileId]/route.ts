/**
 * GET /api/files/open/[fileId] — the link-as-key hand-off.
 *
 * RIM is the gate: after verifying the viewer can reach this file's drive,
 * the route ensures the anyone-with-link permission exists (minting it
 * just-in-time, so files created directly in Drive work too), records the
 * hand-off in RIM's audit log, and redirects into Google's own UI — the
 * real editor for Docs/Sheets/Slides, the preview for everything else.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessFileDrive, filesViewer, logFileAction } from "@/lib/googleFiles";
import { GOOGLE_MIME, ensureAnyoneWithLinkEditor, getFile } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

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

    await ensureAnyoneWithLinkEditor(fileId);
    await logFileAction({
      userId: viewer.userId,
      action: "mint-link",
      googleFileId: fileId,
      detail: { driveId: file.driveId ?? null, mimeType: file.mimeType },
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
