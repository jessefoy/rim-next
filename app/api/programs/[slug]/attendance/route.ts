import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cleanDay, sessionTeamAccess } from "@/lib/sessionHelpers";

// ─── POST /api/programs/[slug]/attendance ────────────────────────────────────
// A supporting team's "Arrived" at the door (2026-10-24, Phase 3 slice 4):
// marks someone with a place as here for one session day, or takes the mark
// back. Allowed for whoever may open that session's page as that team
// (lib/sessionHelpers.ts): assigned to it, the team's coordinators, the
// guiding teacher. Writes nothing else.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to mark." }, { status: 400 });
  }
  const day = cleanDay(body.day);
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : "";
  const team = typeof body.team === "string" ? body.team : null;
  const arrived = body.arrived === true;
  if (!day || !registrationId) return NextResponse.json({ error: "Nothing to mark." }, { status: 400 });

  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, slug: true, hostingHubSlug: true, archivedAt: true },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  if (program.archivedAt && arrived) {
    return NextResponse.json({ error: "This program is archived, so arrivals aren't marked." }, { status: 409 });
  }
  const access = await sessionTeamAccess(session.user.id, session.user.roles, program, day, team);
  if (!access) return NextResponse.json({ error: "Only the team helping at this session can mark arrivals." }, { status: 403 });

  // Marking needs a place; taking a mark back only that it's this program's
  // (someone cancelled after arriving can still be unmarked).
  const registration = await db.registration.findFirst({
    where: { id: registrationId, programSlug: program.slug, ...(arrived ? { status: { in: ["REGISTERED", "APPROVED"] } } : {}) },
    select: { id: true },
  });
  if (!registration) return NextResponse.json({ error: "That person isn't registered for this program." }, { status: 404 });

  if (arrived) {
    await db.registrationAttendance.upsert({
      where: { registrationId_day: { registrationId, day } },
      create: { programId: program.id, registrationId, day, markedById: session.user.id },
      update: {},
    });
  } else {
    await db.registrationAttendance.deleteMany({ where: { registrationId, day } });
  }
  return NextResponse.json({ ok: true, arrived });
}
