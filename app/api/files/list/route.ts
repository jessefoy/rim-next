/**
 * GET /api/files/list?place=<key>&folder=<id> — one folder of one place.
 *
 * The Finder's navigation endpoint. The place key ("community" / "hub:<slug>")
 * is resolved + authorized server-side (lib/googleFiles.ts); the folder id is
 * verified to live in that place's drive before its name is returned. The
 * client never supplies a drive id.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { filesViewer, resolvePlace } from "@/lib/googleFiles";
import { GOOGLE_MIME, getFile, listFiles } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = filesViewer(await auth());
  if (!viewer) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const placeKey = req.nextUrl.searchParams.get("place") ?? "";
  const folder = req.nextUrl.searchParams.get("folder");

  const place = await resolvePlace(viewer.userId, viewer.roles, placeKey);
  if (!place) {
    return NextResponse.json(
      { error: "You don't have access to these files." },
      { status: 404 },
    );
  }

  try {
    let folderId = place.rootId;
    let folderName: string | null = null;
    if (folder && folder !== place.rootId) {
      // Cold-load into a subfolder (refresh / shared URL): confirm the folder
      // belongs to this place's drive before revealing its name or children.
      const f = await getFile(folder);
      if (f.driveId !== place.driveId || f.mimeType !== GOOGLE_MIME.folder) {
        return NextResponse.json(
          { error: "That folder isn't in this space." },
          { status: 404 },
        );
      }
      folderId = folder;
      folderName = f.name;
    }

    const files = await listFiles(place.driveId, folderId);
    return NextResponse.json({
      folderName,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime ?? null,
        modifiedBy: f.lastModifyingUser?.displayName ?? null,
      })),
    });
  } catch (e) {
    console.error("[files-list]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't load these files. Please try again." },
      { status: 502 },
    );
  }
}
