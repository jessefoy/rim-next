import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

async function loadOwnProfile(id: string, userId: string) {
  const profile = await db.roleProfile.findUnique({ where: { id } });
  if (!profile) return { profile: null as null, error: "Not found" as const, status: 404 as const };
  if (profile.userId !== userId) return { profile: null as null, error: "Forbidden" as const, status: 403 as const };
  return { profile, error: null, status: 200 as const };
}

/**
 * PATCH /api/account/role-profiles/[id]
 *
 * Update one of the current user's own role profiles.
 * Body: any of { title, roleKey, description, isPrimary, sortOrder }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { profile, error, status } = await loadOwnProfile(id, session.user.id);
  if (!profile) return NextResponse.json({ error }, { status });

  const body = await req.json();
  const data: Prisma.RoleProfileUpdateInput = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    }
    data.title = title;
  }

  if ("roleKey" in body) {
    const roleKey =
      typeof body.roleKey === "string" && body.roleKey.trim() !== ""
        ? body.roleKey.trim()
        : null;
    data.roleKey = roleKey;
  }

  if ("description" in body) {
    data.description = body.description ?? Prisma.JsonNull;
  }

  if (typeof body.isPrimary === "boolean") {
    data.isPrimary = body.isPrimary;
  }

  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.trunc(body.sortOrder);
  }

  try {
    const updated = await db.roleProfile.update({ where: { id }, data });
    return NextResponse.json({ profile: updated });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You already have a profile for this role." },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * DELETE /api/account/role-profiles/[id]
 *
 * Remove one of the current user's own role profiles.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { profile, error, status } = await loadOwnProfile(id, session.user.id);
  if (!profile) return NextResponse.json({ error }, { status });

  await db.roleProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
