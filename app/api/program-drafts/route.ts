/**
 * POST /api/program-drafts: start a program being set up (2026-10-28, Phase
 * 2), from a shape ({ shape }), a copy ({ copy }) or nothing. Anyone who may
 * use Programs. Answers with the draft's id; nothing is a program until
 * Publish (lib/programDrafts.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUsePrograms } from "@/lib/toolAuth";
import { startingSetup } from "@/lib/programDrafts";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { shape?: string; copy?: string };
  const actor = { id: session.user.id, roles: session.user.roles ?? [] };
  const start = await startingSetup(actor, { shape: body.shape ?? null, copy: body.copy ?? null });
  if ("error" in start) return NextResponse.json({ error: start.error }, { status: 404 });
  const draft = await db.programDraft.create({
    data: { createdById: session.user.id, data: start.data as object, shape: start.shape, copiedFrom: start.copiedFrom },
    select: { id: true },
  });
  return NextResponse.json({ id: draft.id }, { status: 201 });
}
