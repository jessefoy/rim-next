import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const teachers = await db.teacher.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, bio: true, photoUrl: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(teachers);
}
