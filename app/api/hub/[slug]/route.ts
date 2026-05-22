import { auth } from "@/auth";
import { db } from "@/lib/db";
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

  const isMember = hub.members.some((m) => m.userId === session.user.id);
  const isAdmin  = (session.user.roles ?? []).includes("ADMIN");
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = hub.members.find((m) => m.userId === session.user.id);
  return NextResponse.json({ hub, member: member ?? null });
}
