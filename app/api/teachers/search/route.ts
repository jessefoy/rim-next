import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const hasAccess = roles.some((r) => ["ADMIN", "TEACHER"].includes(r));
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const teachers = await db.teacher.findMany({
    where: {
      isActive: true,
      ...(q
        ? { name: { contains: q, mode: "insensitive" } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
    take: 20,
  });

  return NextResponse.json(teachers);
}
