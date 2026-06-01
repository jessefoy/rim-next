import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export interface AdminCourse {
  slug: string;
  name: string;
  // Orthogonal-flag model (session 123). The legacy accessLevel field
  // is no longer surfaced to admin clients — CourseAccessSection
  // decides "does this member already have access?" from the new flags
  // + their registrations + manual grants.
  allowSelfEnroll: boolean;
  selfEnrollDanaRequired: boolean;
  requiredRoles: string[];
  linkedByPrograms: { slug: string; name: string }[];
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN" || r === "REGISTRAR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const courses = await db.course.findMany({
    orderBy: { title: "asc" },
    include: {
      programs: { select: { programId: true } },
    },
  });

  // Resolve linked program names from Postgres. ProgramCourse.programId is a
  // relation to Program.id — programs live in Postgres. (The prior lookup here
  // queried Sanity, which never matched these IDs, so linkedByPrograms was
  // always empty. Session 134 cleanup.)
  const allProgramIds = [...new Set(courses.flatMap((c) => c.programs.map((p) => p.programId)))];
  let programMap = new Map<string, { slug: string; name: string }>();
  if (allProgramIds.length > 0) {
    const programs = await db.program.findMany({
      where: { id: { in: allProgramIds } },
      select: { id: true, slug: true, name: true },
    });
    programMap = new Map(programs.map((p) => [p.id, { slug: p.slug, name: p.name }]));
  }

  const result: AdminCourse[] = courses.map((c) => ({
    slug: c.slug,
    name: c.title,
    allowSelfEnroll: c.allowSelfEnroll,
    selfEnrollDanaRequired: c.selfEnrollDanaRequired,
    requiredRoles: c.requiredRoles as string[],
    linkedByPrograms: c.programs
      .map((pc) => programMap.get(pc.programId))
      .filter((p): p is { slug: string; name: string } => !!p),
  }));

  return NextResponse.json(result);
}
