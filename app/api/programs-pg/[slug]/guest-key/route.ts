/**
 * POST /api/programs-pg/[slug]/guest-key — Reset guest access key (REGISTRAR | ADMIN)
 *
 * Generates a new random key, invalidating the previous guest link immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, isOpenAccess: true },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  if (!program.isOpenAccess) {
    return NextResponse.json({ error: "Program is not open access" }, { status: 400 });
  }

  const guestAccessKey = randomBytes(6).toString("hex");

  await db.program.update({
    where: { slug },
    data: { guestAccessKey },
  });

  return NextResponse.json({ guestAccessKey });
}
