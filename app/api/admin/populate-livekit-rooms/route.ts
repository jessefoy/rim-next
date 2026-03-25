import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/admin/populate-livekit-rooms
 * One-time migration: sets livekitRoom = slug for all virtual/hybrid programs.
 * ADMIN only. Safe to re-run (skips programs that already have a livekitRoom).
 * Delete this file after running.
 */
export async function GET() {
  return POST();
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const programs = await db.program.findMany({
    where: {
      programFormat: { in: ["virtual", "hybrid"] },
      livekitRoom: null,
    },
    select: { id: true, slug: true, name: true },
  });

  for (const p of programs) {
    await db.program.update({
      where: { id: p.id },
      data: { livekitRoom: p.slug },
    });
  }

  return NextResponse.json({
    updated: programs.length,
    programs: programs.map((p) => p.slug),
  });
}
