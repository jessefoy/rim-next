import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/site-banner/dismiss — member dismisses a banner
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bannerId } = await req.json();
  if (!bannerId) return NextResponse.json({ error: "Missing bannerId" }, { status: 400 });

  await db.siteBannerDismissal.upsert({
    where: { bannerId_userId: { bannerId, userId: session.user.id } },
    create: { bannerId, userId: session.user.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
