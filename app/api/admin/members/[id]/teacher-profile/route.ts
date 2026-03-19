import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/members/[id]/teacher-profile
 * Upsert TeacherProfile for a member. ADMIN only.
 * Body: { bio?, photoUrl?, slug?, isPublic? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const user = await db.user.findUnique({ where: { id }, select: { id: true, isTeacher: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Validate slug uniqueness if provided
  const slug: string | null = typeof body.slug === "string" ? body.slug.trim() || null : undefined;
  if (slug !== undefined && slug !== null) {
    const conflict = await db.teacherProfile.findFirst({
      where: { slug, userId: { not: id } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "That slug is already used by another teacher profile." },
        { status: 409 }
      );
    }
  }

  const profile = await db.teacherProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      bio: body.bio ?? null,
      photoUrl: body.photoUrl ?? null,
      slug: slug ?? null,
      isPublic: body.isPublic ?? false,
    },
    update: {
      ...(body.bio !== undefined && { bio: body.bio || null }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
      ...(slug !== undefined && { slug }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
    },
  });

  return NextResponse.json({
    bio: profile.bio,
    photoUrl: profile.photoUrl,
    slug: profile.slug,
    isPublic: profile.isPublic,
  });
}
