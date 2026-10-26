import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { recordRegistrationEvent } from "@/lib/registrationEvents";

// ─── POST /api/programs/[slug]/sign-in-printed ───────────────────────────────
// The sign-in list was printed (2026-10-25): kept in the program's History
// when the page prints, not when it loads, so a reload or a stray visit isn't
// counted as a print (a trial found a print no one made).

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;
  const program = await db.program.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  const count = await db.registration.count({
    where: { programSlug: slug, status: { in: ["REGISTERED", "APPROVED"] } },
  });
  await recordRegistrationEvent({
    kind: "printed",
    programId: program.id,
    programSlug: program.slug,
    actorId: session.user.id,
    detail: { count },
  });
  return NextResponse.json({ ok: true });
}
