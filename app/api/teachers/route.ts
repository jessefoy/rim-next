import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const teachers = await db.teacher.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { lessons: true } } },
  });

  return NextResponse.json(teachers);
}
