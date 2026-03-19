import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/members/search?q=
 * Search active members by name. Returns id, firstName, lastName.
 * TEACHER and ADMIN access only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.some((r: string) => ["ADMIN", "TEACHER"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const members = await db.user.findMany({
    where: {
      archivedAt: null,
      agreedToTerms: true,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { preferredName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, preferredName: true },
    take: 20,
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      firstName: m.preferredName || m.firstName || "",
      lastName: m.lastName || "",
    }))
  );
}
