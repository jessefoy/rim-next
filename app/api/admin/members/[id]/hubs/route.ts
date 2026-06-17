import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { removeHubMembershipWithCleanup } from "@/lib/removeHubMembership";

/**
 * Hub memberships for a member, managed from the Member Registry profile.
 *
 * ADMIN + REGISTRAR only — the registry is the record-authority surface
 * (RIM_System_Architecture.md). This is the deliberate shift where the Member
 * Registry *writes* hub membership (previously hubs owned their rosters): it
 * lets an admin/registrar pre-stage a person onto any hub before launch —
 * including a legacy-pool account reached via `?pool=legacy`. GUIDING_TEACHER
 * is intentionally NOT here: GT assigns hub members from inside each hub, and
 * the registry stays closed to GT by design (RIM_Role_Design.md).
 *
 *   GET    → { hubs: [all ACTIVE hubs], memberships: [this member's rows] }
 *   POST   → { hubSlug, isCoordinator? }   upsert (add, or flip coordinator)
 *   DELETE → { hubSlug }                   hard-remove + FK-safe coverage cleanup
 *
 * Adds are silent by design (pre-staging) — no hub-welcome email. The
 * pre-threshold gate would suppress it for staged/legacy accounts anyway.
 */

function isAuthorized(roles: string[] | undefined): boolean {
  return !!roles?.some((r) => r === "ADMIN" || r === "REGISTRAR");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAuthorized(session?.user?.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [hubs, memberships] = await Promise.all([
    db.hub.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, type: true },
    }),
    db.hubMember.findMany({
      where: { userId: id },
      select: { hubId: true, isCoordinator: true, status: true },
    }),
  ]);

  return NextResponse.json({ hubs, memberships });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAuthorized(session?.user?.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, archivedAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.archivedAt) {
    return NextResponse.json({ error: "Cannot assign an archived member to a hub." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { hubSlug, isCoordinator } = body as { hubSlug?: string; isCoordinator?: boolean };
  if (!hubSlug) return NextResponse.json({ error: "hubSlug required" }, { status: 400 });

  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { id: true, status: true },
  });
  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  if (hub.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cannot assign to an archived hub." }, { status: 400 });
  }

  // Upsert: create the membership, or flip just the coordinator flag on an
  // existing one. Never touch coordinator-owned fields (status, hostingCapability,
  // pause notes) — those belong to the in-hub coordinator tools.
  const member = await db.hubMember.upsert({
    where: { hubId_userId: { hubId: hub.id, userId: id } },
    create: { hubId: hub.id, userId: id, isCoordinator: !!isCoordinator },
    update: { isCoordinator: !!isCoordinator },
    select: { hubId: true, isCoordinator: true, status: true },
  });

  // Coordinator is a real privilege grant (full hub coverage authority), so log
  // the write — mirrors the DELETE path's audit line.
  console.log(
    `[admin-member-hubs] set ${id} on ${hubSlug} (coordinator=${member.isCoordinator}).`,
  );

  return NextResponse.json(member);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAuthorized(session?.user?.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { hubSlug } = body as { hubSlug?: string };
  if (!hubSlug) return NextResponse.json({ error: "hubSlug required" }, { status: 400 });

  const hub = await db.hub.findUnique({ where: { slug: hubSlug }, select: { id: true } });
  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  const existing = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId: id } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not a member of this hub" }, { status: 404 });

  const { removedAssignments, removedRules } = await removeHubMembershipWithCleanup(hub.id, hubSlug, id);
  console.log(
    `[admin-member-hubs] removed ${id} from ${hubSlug} + ${removedAssignments} future assignment(s) + ${removedRules} rotation rule(s).`,
  );

  return NextResponse.json({ ok: true, removedAssignments, removedRules });
}
