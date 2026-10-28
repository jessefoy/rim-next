/**
 * POST /api/program-drafts/[id]/publish: make the program from the draft
 * (2026-10-28, Phase 2), through createProgram as the person publishing: the
 * teams are told now, not before. lib/programDrafts.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUsePrograms } from "@/lib/toolAuth";
import { publishDraft } from "@/lib/programDrafts";
import type { SetupData } from "@/lib/programSetup";

// Publishing tells the teams (in after()), as creating always has.
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  // The answers on screen, so what's published is what the review showed.
  const sent = (await request.json().catch(() => ({}))) as { data?: unknown };
  const latest = sent.data && typeof sent.data === "object" && !Array.isArray(sent.data) ? (sent.data as SetupData) : undefined;
  const result = await publishDraft({ id: session.user.id, roles: session.user.roles ?? [] }, id, latest);
  return NextResponse.json(result.body, { status: result.status });
}
