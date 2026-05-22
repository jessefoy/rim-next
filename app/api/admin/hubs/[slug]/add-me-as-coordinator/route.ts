/**
 * POST /api/admin/hubs/[slug]/add-me-as-coordinator
 *
 * Bootstrap the calling ADMIN into a hub as a coordinator + active member.
 * Created session 128 follow-up after ADMIN lost its content-access bypass:
 * an ADMIN who creates a new hub can no longer enter it (hub access now
 * requires a HubMember row).  This endpoint closes the catch-22 so the
 * admin who just created the hub can immediately bootstrap themselves in
 * as the first coordinator.
 *
 * ADMIN-only.  Upserts a HubMember row for the caller with full coordinator
 * defaults — active status, hosting capability, communications on.  Safe to
 * call on a hub where the admin is already a coordinator (idempotent).
 *
 * If the admin is already a member but not a coordinator, promotes them.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json(
      { error: "Only admins can self-bootstrap into a hub." },
      { status: 403 },
    );
  }

  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug } });
  if (!hub) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  // Upsert: create if absent, promote to coordinator if already a member.
  // Coordinator defaults match what `syncHubMembership` would set for an
  // active role-based member, plus isCoordinator: true.
  const existing = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
  });

  if (existing) {
    if (existing.isCoordinator && existing.status === "ACTIVE") {
      return NextResponse.json({ ok: true, alreadyCoordinator: true });
    }
    await db.hubMember.update({
      where: { id: existing.id },
      data: {
        isCoordinator: true,
        status: "ACTIVE",
        hostingCapability: true,
        communicationsEnabled: true,
      },
    });
    return NextResponse.json({ ok: true, promoted: true });
  }

  await db.hubMember.create({
    data: {
      hubId: hub.id,
      userId: session.user.id,
      isCoordinator: true,
      status: "ACTIVE",
      hostingCapability: true,
      communicationsEnabled: true,
      position: "Coordinator",
    },
  });

  return NextResponse.json({ ok: true, created: true });
}
