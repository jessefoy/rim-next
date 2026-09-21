import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { authorizeFileRead, authorizeFileWrite, isCrossSiteRequest } from "@/lib/googleFiles";
import { parseFileOrganization } from "@/lib/fileOrganization";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  if (isCrossSiteRequest(req)) return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  const body = parseFileOrganization(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Choose a valid file preference." }, { status: 400 });
  try {
    const { fileId } = await params;
    const session = await auth();
    const gate = await authorizeFileRead(session, fileId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { viewer, place, meta } = gate.data;
    if (place.key !== body.place || meta?.pendingDeleteAt) return NextResponse.json({ error: "This file is not available here." }, { status: 404 });
    if (body.pinned !== undefined) {
      const writeGate = await authorizeFileWrite(session, req, fileId);
      if (!writeGate.ok) return NextResponse.json({ error: writeGate.error }, { status: writeGate.status });
      if (body.pinned && meta?.heldAt) return NextResponse.json({ error: "Share this draft before pinning it for the team." }, { status: 400 });
    }
    await db.$transaction(async tx => {
      if (body.favorite !== undefined || body.color !== undefined) {
        const data = { ...(body.favorite !== undefined ? { favorite: body.favorite } : {}), ...(body.color !== undefined ? { color: body.color?.toLowerCase() ?? null } : {}) };
        await tx.googleFilePreference.upsert({
          where: { userId_placeKey_googleFileId: { userId: viewer.userId, placeKey: place.key, googleFileId: fileId } },
          create: { userId: viewer.userId, placeKey: place.key, googleFileId: fileId, ...data }, update: data,
        });
      }
      if (body.pinned !== undefined) {
        const key = { placeKey: place.key, googleFileId: fileId };
        if (body.pinned) await tx.googleFilePin.upsert({ where: { placeKey_googleFileId: key }, create: { ...key, pinnedByUserId: viewer.userId }, update: {} });
        else await tx.googleFilePin.deleteMany({ where: key });
        await tx.googleFileAudit.create({ data: { userId: viewer.userId, hubId: place.hubId, googleFileId: fileId, action: body.pinned ? "pin" : "unpin", detail: { place: place.key } } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[file-organization]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't save that preference. Please try again." }, { status: 502 });
  }
}
