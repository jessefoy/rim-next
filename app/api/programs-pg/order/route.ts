/**
 * POST /api/programs-pg/order — which programs are shown first in their
 * sections of Programs & Events, in order (2026-10-28, Phase 3): { first:
 * [slug, …], shown: [slug, …] }. Those get listFirst 1, 2, 3…; every other program shown loses it and
 * takes its place by when it meets (lib/programOrder.ts). Anyone who may use
 * Programs, as for any program's "Show it first".
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUsePrograms } from "@/lib/toolAuth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { first?: unknown; shown?: unknown };
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 500) : null);
  const first = strings(body.first);
  // Only the programs the page showed lose "first": a hidden or archived
  // program keeps its place for when it's listed again.
  const shown = strings(body.shown);
  if (!first || !shown) return NextResponse.json({ error: "The order wasn't understood. Reload the page and try again." }, { status: 400 });
  await db.$transaction([
    db.program.updateMany({ where: { listFirst: { not: null }, slug: { in: shown, notIn: first } }, data: { listFirst: null } }),
    ...first.map((slug, i) => db.program.updateMany({ where: { slug }, data: { listFirst: i + 1 } })),
  ]);
  return NextResponse.json({ ok: true });
}
