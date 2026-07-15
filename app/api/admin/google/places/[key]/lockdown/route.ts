/**
 * POST /api/admin/google/places/[key]/lockdown — ADMIN only.
 *
 * Sweeps every file this place has ever minted a link for and revokes it
 * (RIM_GoogleWorkspace.md §5; backlog 2026-07-14-001) — the "cut off a
 * leaked link, harden a sensitive drive" action. The place key is resolved
 * server-side (never trusted from the client) so the sweep can only ever
 * target a real, currently files-enabled place.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { lockdownPlace, resolveAdminPlace } from "@/lib/googleFileAdmin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { key } = await params;

  const place = await resolveAdminPlace(key);
  if (!place) {
    return NextResponse.json({ error: "That place isn't set up for Files." }, { status: 404 });
  }

  try {
    const result = await lockdownPlace({ hubId: place.hubId, adminUserId: session.user.id });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[admin-google-lockdown]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Could not finish locking this down. Please try again." },
      { status: 502 },
    );
  }
}
