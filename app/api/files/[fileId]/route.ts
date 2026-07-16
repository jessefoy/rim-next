/**
 * PATCH /api/files/[fileId] — rename, move, or trash one file/folder
 * (RIM_GoogleWorkspace.md, Slice 3). Drive itself models all three as file
 * PATCHes, so RIM does too: one gated route, three actions.
 *
 * Body: { action: "rename", name } | { action: "move", folder: string | null }
 *     | { action: "trash" }
 *
 * The shared authorizeFileWrite gate handles cross-site refusal, the read
 * gate (file's drive must be one of the viewer's places), write authority
 * (Community: every member; hub: ACTIVE membership or GT), and the
 * browse-anchor protection. "Trash" is Drive's own trash — recoverable for
 * ~30 days; RIM exposes no permanent delete to members (admins hold the
 * final say by construction).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  authorizeFileWrite,
  canManageFileMeta,
  fileRowJson,
  logFileAction,
  resolveParentFolder,
  sanitizeFileName,
} from "@/lib/googleFiles";
import { moveFile, renameFile, trashFile } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  let body: { action?: unknown; name?: unknown; folder?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  try {
    const gate = await authorizeFileWrite(await auth(), req, fileId);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const { viewer, file, place } = gate.data;

    if (body.action === "rename") {
      const name = sanitizeFileName(body.name);
      if (!name) {
        return NextResponse.json({ error: "Please give it a name." }, { status: 400 });
      }
      if (name === file.name) return NextResponse.json({ file: fileRowJson(file) });
      const updated = await renameFile(fileId, name);
      await logFileAction({
        userId: viewer.userId,
        action: "rename",
        googleFileId: fileId,
        hubId: place.hubId,
        detail: { place: place.key, from: file.name, to: name },
      });
      return NextResponse.json({ file: fileRowJson(updated) });
    }

    if (body.action === "move") {
      const folder = typeof body.folder === "string" ? body.folder : null;
      if (folder === fileId) {
        return NextResponse.json(
          { error: "A folder can't be moved into itself." },
          { status: 400 },
        );
      }
      const target = await resolveParentFolder(place, folder);
      if (!target) {
        return NextResponse.json(
          { error: "That folder isn't in this space." },
          { status: 404 },
        );
      }
      const currentParent = file.parents?.[0];
      if (target.id === currentParent) return NextResponse.json({ file: fileRowJson(file) });
      try {
        const updated = await moveFile(fileId, {
          addParent: target.id,
          removeParent: currentParent,
        });
        await logFileAction({
          userId: viewer.userId,
          action: "move",
          googleFileId: fileId,
          hubId: place.hubId,
          detail: { place: place.key, name: file.name, from: currentParent, to: target.id },
        });
        return NextResponse.json({ file: fileRowJson(updated) });
      } catch (e) {
        // Drive refuses invalid moves (e.g. a folder into its own subtree)
        // with a 400. The status is contractual where the message text isn't
        // (driveApi embeds "failed (400)") — map ANY move 400 to a friendly,
        // non-retryable answer instead of the generic "try again" 502.
        if (e instanceof Error && /failed \(400\)/.test(e.message)) {
          return NextResponse.json(
            { error: "That move isn't possible. Try a different folder." },
            { status: 400 },
          );
        }
        throw e;
      }
    }

    if (body.action === "trash") {
      await trashFile(fileId);
      await logFileAction({
        userId: viewer.userId,
        action: "trash",
        googleFileId: fileId,
        hubId: place.hubId,
        detail: { place: place.key, name: file.name, mimeType: file.mimeType },
      });
      return NextResponse.json({ ok: true });
    }

    // Draft toggle — hold a file back from the Space, or share it in. Neither
    // touches Google; both flip RIM's own GoogleFileMeta.heldAt. Restricted
    // beyond baseline write access to the file's creator, a Space coordinator,
    // or a GUIDING_TEACHER/ADMIN (canManageFileMeta).
    if (body.action === "hold" || body.action === "share") {
      const meta = await db.googleFileMeta.findUnique({ where: { googleFileId: fileId } });
      if (!(await canManageFileMeta(viewer, place, meta))) {
        return NextResponse.json(
          { error: "Only the file's creator or a coordinator can change this." },
          { status: 403 },
        );
      }
      const heldAt = body.action === "hold" ? new Date() : null;
      await db.googleFileMeta.upsert({
        where: { googleFileId: fileId },
        update: { heldAt },
        create: {
          googleFileId: fileId,
          heldAt,
          creatorUserId: meta?.creatorUserId ?? null,
          hubId: place.hubId,
          placeKey: place.key,
        },
      });
      await logFileAction({
        userId: viewer.userId,
        action: body.action,
        googleFileId: fileId,
        hubId: place.hubId,
        detail: { place: place.key, name: file.name },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  } catch (e) {
    console.error("[files-update]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't make that change. Please try again." },
      { status: 502 },
    );
  }
}
