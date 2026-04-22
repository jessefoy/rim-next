import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * GET /api/account/role-profiles
 *
 * List the current user's role profiles, ordered by sortOrder.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await db.roleProfile.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ profiles });
}

/**
 * POST /api/account/role-profiles
 *
 * Create a new role profile on the current user's account.
 * Body: { title: string, roleKey?: string | null, description?: unknown | null }
 * Returns the created record, or 409 if the [userId, roleKey] uniqueness
 * constraint is violated.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Place new profiles at the end of the current list.
  const last = await db.roleProfile.findFirst({
    where: { userId: session.user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  try {
    const profile = await db.roleProfile.create({
      data: {
        userId: session.user.id,
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
        { error: "You already have a profile for this role." },
        { status: 409 },
      );
    }
    throw err;
  }
}
