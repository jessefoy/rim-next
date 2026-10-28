import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveTeacherProfile } from "@/lib/contentSaves";

/**
 * PATCH /api/admin/members/[id]/teacher-profile
 * Upsert TeacherProfile for a member and set isTeacher flag. ADMIN only.
 * Body: { isTeacher?, bio?, photoUrl?, slug?, isPublic? }
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

  // The save itself (lib/contentSaves.ts) is shared with the RIM Guide.
  const result = await saveTeacherProfile(id, body);
  return NextResponse.json(result.body, { status: result.status });
}
