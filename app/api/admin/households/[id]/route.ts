import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function hasAccess(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("REGISTRAR");
}

// GET /api/admin/households/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const household = await db.household.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              addressLine1: true,
              addressCity: true,
              addressState: true,
              addressZip: true,
            },
          },
        },
      },
    },
  });

  if (!household) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(household);
}

// PATCH /api/admin/households/[id] — update name, address, notes
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, addressLine1, addressCity, addressState, addressZip, notes } = body;

  const household = await db.household.update({
    where: { id },
    data: {
      name: name !== undefined ? (name || null) : undefined,
      addressLine1: addressLine1 !== undefined ? (addressLine1 || null) : undefined,
      addressCity: addressCity !== undefined ? (addressCity || null) : undefined,
      addressState: addressState !== undefined ? (addressState || null) : undefined,
      addressZip: addressZip !== undefined ? (addressZip || null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  return NextResponse.json(household);
}

// DELETE /api/admin/households/[id] — admin only
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const count = await db.householdMember.count({ where: { householdId: id } });
  if (count > 1) {
    return NextResponse.json(
      { error: "Remove all members before deleting this household." },
      { status: 400 }
    );
  }

  await db.household.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
