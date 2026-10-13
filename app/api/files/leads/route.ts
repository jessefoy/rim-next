/**
 * POST /api/files/leads { place } — open the team's "Leads only" area: returns
 * its folder id, creating the folder inside the team's Space folder the first
 * time (lib/googleFiles.ts::ensureLeadsFolder). Leads only: an ACTIVE
 * coordinator of the team, GUIDING_TEACHER or ADMIN (Jesse, 2026-10-13).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureLeadsFolder, resolveWritablePlace } from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { place?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }
  const placeKey = typeof body.place === "string" ? body.place : "";
  const gate = await resolveWritablePlace(await auth(), req, placeKey);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { viewer, place } = gate.data;
  if (!place.isLead) {
    return NextResponse.json({ error: "Leads only is for this team's leads." }, { status: 403 });
  }
  try {
    const folderId = await ensureLeadsFolder(place, viewer.userId);
    return NextResponse.json({ folderId });
  } catch (e) {
    console.error("[files-leads]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't open Leads only. Please try again." },
      { status: 502 },
    );
  }
}
