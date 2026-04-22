import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * GET /api/admin/members/[id]/role-profiles
 *
 * ADMIN-only: list a member's role profiles.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const profiles = await db.roleProfile.findMany({
    where: { userId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ profiles });
}

/**
 * POST /api/admin/members/[id]/role-profiles
 *
 * ADMIN-only: create a role profile on a member's behalf.
 * Body: { title: string, roleKey?: string | null, description?: unknown | null }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const roleKey =
    typeof body.roleKey === "string" && body.roleKey.trim() !== ""
      ? body.roleKey.trim()
      : null;

  const last = await db.roleProfile.findFirst({
    where: { userId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  try {
    const profile = await db.roleProfile.create({
      data: {
        userId: id,
        title,
        roleKey,
        description: body.description ?? Prisma.JsonNull,
        sortOrder,
      },
    });
    return NextResponse.json({ profile }, { status: 201 });
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
