/**
 * One-time: every team's Team files into its "Leads only" folder (Jesse,
 * 2026-10-13: "Do it now for every team"), so each team's leads decide what
 * to move back for everyone. ADMIN only.
 *   GET  — preview: how many top-level items each team would move (no change)
 *   POST — move them (lib/googleFiles.ts::moveTeamFilesToLeads), team by team
 * Remove this route and its admin panel once it has run.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filesViewer, isCrossSiteRequest, moveTeamFilesToLeads } from "@/lib/googleFiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function adminViewer() {
  const viewer = filesViewer(await auth());
  return viewer && viewer.roles.includes("ADMIN") ? viewer : null;
}

async function teams() {
  return db.hub.findMany({
    where: { status: "ACTIVE", googleFilesEnabled: true, googleDriveId: { not: null } },
    select: { id: true },
    orderBy: { name: "asc" },
  });
}

export async function GET() {
  const viewer = await adminViewer();
  if (!viewer) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const results = [];
    for (const t of await teams()) {
      results.push(await moveTeamFilesToLeads(t.id, viewer.userId, { dryRun: true }));
    }
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[files-leads-all] preview", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't read the teams' files. Please try again." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  const viewer = await adminViewer();
  if (!viewer) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const results = [];
  for (const t of await teams()) {
    try {
      results.push(await moveTeamFilesToLeads(t.id, viewer.userId, { dryRun: false }));
    } catch (e) {
      console.error("[files-leads-all] team", t.id, e instanceof Error ? e.message : e);
      results.push({ team: t.id, items: 0, moved: 0, failed: -1, revoked: 0 });
    }
  }
  console.log("[files-leads-all] done", JSON.stringify(results));
  return NextResponse.json({ results });
}
