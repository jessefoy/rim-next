import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * PATCH /api/admin/role-profiles/[id]
 *
 * ADMIN-only: edit any role profile.
 * Body: any of { title, roleKey, description, isPrimary, sortOrder }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.roleProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
        { error: "This member already has a profile for that role." },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * DELETE /api/admin/role-profiles/[id]
 *
 * ADMIN-only: remove any role profile.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.roleProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.roleProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
