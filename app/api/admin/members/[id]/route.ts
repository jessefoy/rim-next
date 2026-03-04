import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

const ALL_ROLES = Object.values(Role);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, firstName, lastName, phone, roles } = body;

  // ── Special actions ──────────────────────────────────────────────────────────

  if (action === "archive") {
    await db.user.update({ where: { id }, data: { archivedAt: new Date() } });
    // Force logout by deleting all active sessions
    await db.session.deleteMany({ where: { userId: id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    await db.user.update({ where: { id }, data: { archivedAt: null } });
    return NextResponse.json({ ok: true });
  }

  // ── Profile / roles update ────────────────────────────────────────────────────

  // Validate roles if provided
  if (roles !== undefined) {
    if (!Array.isArray(roles) || roles.some((r: string) => !ALL_ROLES.includes(r as Role))) {
      return NextResponse.json({ error: "Invalid roles" }, { status: 400 });
    }
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(roles !== undefined && { roles }),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      roles: true,
      archivedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...updated,
    archivedAt: updated.archivedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (session?.user?.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { registrations: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user._count.registrations > 0) {
    return NextResponse.json(
      { error: `Member has ${user._count.registrations} registration(s). Archive instead.` },
      { status: 409 }
    );
  }

  // Cascade handles: Account, Session, CourseAccess, UserMembership, AttendanceRecord
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
