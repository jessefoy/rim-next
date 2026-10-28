/**
 * GET  /api/programs-pg — List all programs (canUseProgramManager: REGISTRAR | ADMIN | GUIDING_TEACHER)
 * POST /api/programs-pg — Create a new program (canUsePrograms: the three roles, or a member of a team with Programs)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseProgramManager, canUsePrograms } from "@/lib/toolAuth";
import { createProgram } from "@/lib/programSave";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  if (!session || !canUseProgramManager(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const programs = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { category: true },
  });

  return NextResponse.json(programs);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  // Anyone who may use Programs may create one (2026-10-24).
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The create itself (lib/programSave.ts) is shared with the RIM Guide.
  const result = await createProgram({ id: session.user.id, roles: session.user.roles ?? [] }, await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
