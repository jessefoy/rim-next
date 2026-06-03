import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessHub } from "@/lib/hubAuth";
import { NextResponse } from "next/server";

// GET /api/hub/[slug] — hub detail + member check
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
  });

  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = hub.members.find((m) => m.userId === session.user.id) ?? null;
  if (!canAccessHub(member, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ hub, member });
}
