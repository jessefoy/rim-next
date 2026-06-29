import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageMindMapSharing } from "@/lib/mindMapAuth";

const VISIBILITIES = ["HUB", "COORDINATORS", "COMMUNITY"];
const EDIT_POLICIES = ["OPEN", "RESTRICTED"];

/**
 * PATCH /api/mindmaps/[id]/visibility — the share dialog's sharing settings:
 * who can SEE the map (`visibility`) and who can EDIT a shared map
 * (`editPolicy`). Origin owns it (canManageMindMapSharing). Either field
 * optional; both validated against their allowed values.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { visibility, editPolicy } = await req.json();
  if (visibility !== undefined && !VISIBILITIES.includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
  }
  if (editPolicy !== undefined && !EDIT_POLICIES.includes(editPolicy)) {
    return NextResponse.json({ error: "Invalid edit policy." }, { status: 400 });
  }

  const [map, memberships] = await Promise.all([
    db.mindMap.findUnique({
      where: { id },
      select: {
        addedById: true,
        hubId: true,
        visibility: true,
        editPolicy: true,
        deletedAt: true,
        placements: { select: { hubId: true } },
      },
    }),
    db.hubMember.findMany({ where: { userId: session.user.id, status: "ACTIVE" }, select: { hubId: true, isCoordinator: true } }),
  ]);
  if (!map || map.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const viewer = { userId: session.user.id, roles: session.user.roles ?? [], memberships };
  if (!canManageMindMapSharing(map, viewer)) {
    return NextResponse.json({ error: "Only the owner can change sharing." }, { status: 403 });
  }

  const updated = await db.mindMap.update({
    where: { id },
    data: {
      ...(visibility !== undefined ? { visibility } : {}),
      ...(editPolicy !== undefined ? { editPolicy } : {}),
    },
    select: { visibility: true, editPolicy: true },
  });
  return NextResponse.json(updated);
}
