/**
 * GET /api/files/pending?place=<key> — the files proposed for removal in a
 * Space, awaiting a lead's decision (RIM_GoogleWorkspace.md, governed deletion).
 *
 * A lead of the Space sees ALL pending items and can approve/cancel them; a
 * plain member sees only their own request (to cancel it). Returns the items
 * plus `canApprove` so the client knows which affordances to show. The Finder
 * fetches this alongside the folder listing to render the "Pending removal"
 * section.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  filesViewer,
  isSpaceLead,
  listPendingRemovals,
  resolvePlace,
} from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = filesViewer(await auth());
  if (!viewer) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const place = await resolvePlace(viewer.userId, viewer.roles, req.nextUrl.searchParams.get("place") ?? "");
  if (!place) {
    return NextResponse.json({ error: "You don't have access to these files." }, { status: 404 });
  }
  try {
    const canApprove = await isSpaceLead(viewer, place);
    const items = await listPendingRemovals(place, viewer, canApprove);
    return NextResponse.json({ items, canApprove });
  } catch (e) {
    console.error("[files-pending]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't load pending removals. Please try again." },
      { status: 502 },
    );
  }
}
