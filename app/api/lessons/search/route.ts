import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "TEACHER"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const lessons = await db.lesson.findMany({
    where: {
      titleInternal: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      titleInternal: true,
      titleDisplayed: true,
      slug: true,
    },
    orderBy: { titleInternal: "asc" },
    take: 20,
  });

  return NextResponse.json(lessons);
}
