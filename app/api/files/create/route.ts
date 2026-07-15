/**
 * POST /api/files/create — create a Google Doc / Sheet / Slides / folder
 * inside one of the viewer's writable places (RIM_GoogleWorkspace.md, Slice 3).
 *
 * Body: { place: string, folder?: string | null, kind: "doc" | "sheet" |
 * "slides" | "folder", name: string }. The shared resolveWritablePlace gate
 * handles cross-site refusal + viewer + place authorization + write
 * authority; the destination folder is verified to live (un-trashed) in that
 * place's drive. Every create is audit-logged.
 *
 * For document kinds the response carries the gated open URL so the client
 * can drop the author straight into the real Google editor.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  fileRowJson,
  logFileAction,
  resolveParentFolder,
  resolveWritablePlace,
  sanitizeFileName,
} from "@/lib/googleFiles";
import { GOOGLE_MIME, createFile } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

const KIND_MIME = {
  doc: GOOGLE_MIME.doc,
  sheet: GOOGLE_MIME.sheet,
  slides: GOOGLE_MIME.slides,
  folder: GOOGLE_MIME.folder,
} as const;
type CreateKind = keyof typeof KIND_MIME;

export async function POST(req: NextRequest) {
  let body: { place?: unknown; folder?: unknown; kind?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" && body.kind in KIND_MIME
    ? (body.kind as CreateKind)
    : null;
  if (!kind) {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }
  const name = sanitizeFileName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Please give it a name." }, { status: 400 });
  }
  const placeKey = typeof body.place === "string" ? body.place : "";
  const folder = typeof body.folder === "string" ? body.folder : null;

  const gate = await resolveWritablePlace(await auth(), req, placeKey);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { viewer, place } = gate.data;

  try {
    const parent = await resolveParentFolder(place, folder);
    if (!parent) {
      return NextResponse.json(
        { error: "That folder isn't in this space." },
        { status: 404 },
      );
    }

    const file = await createFile({ name, mimeType: KIND_MIME[kind], parentId: parent.id });
    await logFileAction({
      userId: viewer.userId,
      action: `create-${kind}`,
      googleFileId: file.id,
      hubId: place.hubId,
      detail: { place: place.key, name, parentId: parent.id },
    });

    return NextResponse.json({
      file: fileRowJson(file),
      // Folders open inside RIM; documents open in Google's editor via the
      // gated link-as-key route (which mints the permission just-in-time).
      openUrl: kind === "folder" ? null : `/api/files/open/${file.id}`,
    });
  } catch (e) {
    console.error("[files-create]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't create that. Please try again." },
      { status: 502 },
    );
  }
}
