/**
 * PATCH /api/program-drafts/[id]: save a draft's answers as the person goes.
 * DELETE: discard it. Anyone who may use Programs (2026-10-28, Phase 2).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUsePrograms } from "@/lib/toolAuth";

/** A draft is a page of answers; this is far more than one needs. */
const MAX_BYTES = 400_000;

async function gate() {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) return null;
  return session;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "This draft is too long to save. Shorten the longest text and try again." }, { status: 413 });
  let body: { data?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "The draft wasn't understood. Reload the page and try again." }, { status: 400 }); }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "The draft wasn't understood. Reload the page and try again." }, { status: 400 });
  }
  const updated = await db.programDraft.updateMany({ where: { id }, data: { data: body.data as object, updatedAt: new Date() } });
  if (updated.count === 0) return NextResponse.json({ error: "This draft isn't here any more. It may have been published or discarded." }, { status: 404 });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.programDraft.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
