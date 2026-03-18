import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const teacher = await db.teacher.findUnique({
    where: { slug },
    include: {
      lessons: {
        include: {
          lesson: {
            include: {
              courses: {
                include: {
                  course: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(teacher);
}
