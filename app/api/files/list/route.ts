/**
 * GET /api/files/list?place=<key>&folder=<id> — one folder of one place.
 *
 * The Finder's navigation endpoint. The place key ("hub:<slug>") is resolved
 * + authorized server-side (lib/googleFiles.ts); the folder id is
 * verified to live in that place's drive before its name is returned. The
 * client never supplies a drive id.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildFileRows,
  filesViewer,
  resolveParentFolder,
  resolvePlace,
} from "@/lib/googleFiles";
import { listFiles } from "@/lib/google/drive";

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
    // Validation (the shared resolveParentFolder predicate — same rule the
    // write routes enforce) and listFiles run in parallel: listFiles is
    // scoped to the drive, so a foreign folder id can only yield an empty
    // list, and the validation still gates the response before return.
    const [resolved, files] = await Promise.all([
      resolveParentFolder(place, folder),
      listFiles(place.driveId, folder ?? place.rootId),
    ]);
    if (!resolved) {
      return NextResponse.json(
        { error: "That folder isn't in this space." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      folderName: resolved.name,
      files: await buildFileRows(files, viewer),
    });
  } catch (e) {
    console.error("[files-list]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't load these files. Please try again." },
      { status: 502 },
    );
  }
}
