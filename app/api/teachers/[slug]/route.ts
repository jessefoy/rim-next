import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const teacher = await db.teacher.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, bio: true, photoUrl: true, isActive: true, createdAt: true },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(teacher);
}
