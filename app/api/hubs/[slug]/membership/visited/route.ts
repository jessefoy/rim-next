import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** PATCH /api/hubs/[slug]/membership/visited — mark first visit + update lastVisitedAt */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const hub = await db.hub.findUnique({ where: { slug }, select: { id: true } });
  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  const member = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
  });

  if (!member) return NextResponse.json({ error: "Not a hub member" }, { status: 403 });

  const now = new Date();
  await db.hubMember.update({
    where: { id: member.id },
    data: {
      lastVisitedAt: now,
      ...(member.firstVisitedAt ? {} : { firstVisitedAt: now }),
    },
  });

  return NextResponse.json({ ok: true });
}
