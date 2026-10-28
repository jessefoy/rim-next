/**
 * POST /api/programs-pg/[slug]/preview — "Before you save" (2026-10-28,
 * Phase 3): what a change would do, without doing it. Same body as the save
 * (PUT /api/programs-pg/[slug]); same gate (canUsePrograms).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUsePrograms } from "@/lib/toolAuth";
import { previewProgramSave } from "@/lib/programSave";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  delete body._base;
  const result = await previewProgramSave({ id: session.user.id, roles: session.user.roles ?? [] }, slug, body);
  return NextResponse.json(result.body, { status: result.status });
}
