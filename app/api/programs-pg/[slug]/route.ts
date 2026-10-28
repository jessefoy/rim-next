/**
 * GET    /api/programs-pg/[slug] — Get single program (canUseProgramManager: REGISTRAR | ADMIN | GUIDING_TEACHER)
 * PUT    /api/programs-pg/[slug] — Update program (canUsePrograms: the three roles, or a member of a team with Programs)
 * DELETE /api/programs-pg/[slug] — Delete program (ADMIN only, safety check)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { teardownProgramMeetings } from "@/lib/sessionMeeting";
import { canUseProgramManager, canUsePrograms } from "@/lib/toolAuth";
import { saveProgram } from "@/lib/programSave";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session || !canUseProgramManager(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    include: {
      category: true,
      programCourses: { include: { course: true } },
      programTeachers: {
        orderBy: { order: "asc" },
        include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      },
    },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session || !canUseProgramManager(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();

  // ── Archive / Restore actions ──
  if (body.action === "archive") {
    const updated = await db.program.update({
      where: { slug },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "restore") {
    const updated = await db.program.update({
      where: { slug },
      data: { archivedAt: null },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  // Anyone who may use Programs may save one (2026-10-24); archiving,
  // restoring and deleting (PATCH, DELETE) stay with the three roles.
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  // The save itself (lib/programSave.ts) is shared with the RIM Guide.
  const result = await saveProgram({ id: session.user.id, roles: session.user.roles ?? [] }, slug, await request.json());
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, archivedAt: true },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Safety: must be archived first
  if (!program.archivedAt) {
    return NextResponse.json(
      { error: "Cannot delete — archive the program first." },
      { status: 400 }
    );
  }

  // Safety: cannot delete if active registrations exist
  const activeRegs = await db.registration.count({
    where: { programId: program.id, status: { in: ["REGISTERED", "APPROVED", "WAITLISTED"] } },
  });
  if (activeRegs > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${activeRegs} active registration(s) exist. Cancel all registrations first.` },
      { status: 400 }
    );
  }

  // Its schedule goes with it: these rows name the program by slug (no
  // database link), so a new program given the same slug would inherit them
  // (2026-10-16 audit). FK-safe: SubClaim → SubRequest → HostAssignment;
  // rotation skips go with their rotations.
  await db.$transaction(async (tx) => {
    const ids = (await tx.hostAssignment.findMany({ where: { programSlug: slug }, select: { id: true } })).map((a) => a.id);
    if (ids.length) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.standingAssignment.deleteMany({ where: { programSlug: slug } });
    await tx.programCoverageHub.deleteMany({ where: { programSlug: slug } });
    await tx.program.delete({ where: { slug } });
  });

  // Tear down any Zoom meetings this program provisioned (Zoom + rows), since
  // SessionMeeting is keyed by slug (no FK) and would otherwise orphan.
  after(async () => {
    try {
      const n = await teardownProgramMeetings(slug, { futureOnly: false });
      if (n > 0) console.log(`[programs-pg] deleted ${slug}; tore down ${n} Zoom meeting(s)`);
    } catch (e) {
      console.error("[programs-pg] Zoom teardown on delete error:", e);
    }
  });

  return NextResponse.json({ success: true });
}
