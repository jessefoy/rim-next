import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { recordRegistrationEvent, staffName } from "@/lib/registrationEvents";

// ─── The registration team's notes on a person (2026-10-23) ──────────────────
// Each note is written once, with its author and date. RegistrationNote.

const MAX_NOTE = 4000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  let body: { body?: unknown; forTeacher?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Write the note first." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write the note first." }, { status: 400 });
  if (text.length > MAX_NOTE) {
    return NextResponse.json({ error: `A note can be up to ${MAX_NOTE} characters.` }, { status: 400 });
  }
  const forTeacher = body.forTeacher === true;

  const reg = await db.registration.findUnique({
    where: { id },
    select: { id: true, programId: true, programSlug: true },
  });
  if (!reg) return NextResponse.json({ error: "Registration not found" }, { status: 404 });

  const [note, author] = await Promise.all([
    db.registrationNote.create({
      data: { registrationId: id, authorId: session.user.id, body: text, forTeacher },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, preferredName: true },
    }),
  ]);
  await recordRegistrationEvent({
    kind: "note-added",
    programId: reg.programId,
    programSlug: reg.programSlug,
    registrationId: id,
    actorId: session.user.id,
    detail: { forTeacher },
  });

  return NextResponse.json({
    note: {
      id: note.id,
      body: note.body,
      forTeacher: note.forTeacher,
      authorName: staffName(author),
      createdAt: note.createdAt.toISOString(),
    },
  });
}
