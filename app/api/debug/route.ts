import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const userId = session.user.id;
  const hubMembers = await db.hubMember.findMany({
    where: { userId },
    include: { hub: { select: { slug: true, name: true } } },
  });

  const hubCount = await db.hub.count();

  return NextResponse.json({
    userId,
    sessionEmail: session.user.email,
    hubCount,
    hubMemberRows: hubMembers.length,
    hubs: hubMembers.map((m) => m.hub.slug),
  });
}
