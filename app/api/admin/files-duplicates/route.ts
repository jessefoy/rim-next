/**
 * Duplicate clean-up for team files (Jesse, 2026-10-13). ADMIN only.
 *   GET  — every team's same-name, same-type files, with a content check and
 *          a suggested copy to keep (read-only)
 *   POST { trash: string[] } — move the chosen copies to Drive's trash
 *          (30-day recovery), each verified to be a file inside a team
 * See lib/googleFiles.ts (findTeamDuplicates, trashDuplicateCopies).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  filesViewer,
  findTeamDuplicates,
  isCrossSiteRequest,
  trashDuplicateCopies,
} from "@/lib/googleFiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function adminViewer() {
  const viewer = filesViewer(await auth());
  return viewer && viewer.roles.includes("ADMIN") ? viewer : null;
}

export async function GET() {
  if (!(await adminViewer())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const hubs = await db.hub.findMany({
      where: { status: "ACTIVE", googleFilesEnabled: true, googleDriveId: { not: null } },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    const groups = [];
    for (const h of hubs) groups.push(...(await findTeamDuplicates(h.id)));
    return NextResponse.json({ groups });
  } catch (e) {
    console.error("[files-duplicates] scan", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't read the teams' files. Please try again." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  const viewer = await adminViewer();
  if (!viewer) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.trash)
    ? [...new Set((body.trash as unknown[]).filter((x): x is string => typeof x === "string"))].slice(0, 300)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing chosen." }, { status: 400 });
  const result = await trashDuplicateCopies(ids, viewer.userId);
  return NextResponse.json(result);
}
