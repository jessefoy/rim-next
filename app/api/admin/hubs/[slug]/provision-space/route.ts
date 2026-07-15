/**
 * POST /api/admin/hubs/[slug]/provision-space — ADMIN only.
 *
 * One-click Files setup for an EXISTING hub: create its folder in the
 * "RIM — Spaces" container drive and map the hub to it, so a hub that
 * predates auto-provisioning becomes Files-ready without any manual Google
 * Console step (the same mechanism new hubs run on creation). Idempotent —
 * a hub that already has a drive mapping (auto or a manual own-drive) is
 * returned unchanged.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { provisionHubSpaceStorage } from "@/lib/googleFiles";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Only admins can set up hub files." }, { status: 403 });
  }

  const { slug } = await params;
  const hub = await db.hub.findUnique({
    where: { slug },
    select: { id: true, name: true, googleDriveId: true, googleRootFolderId: true },
  });
  if (!hub) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  try {
    const result = await provisionHubSpaceStorage(hub, session.user.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[provision-space]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't set up files for this hub. Please try again." },
      { status: 502 },
    );
  }
}
