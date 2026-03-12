import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendFirstTimeAttendeeEmail,
  sendReturningAfterAbsenceEmail,
} from "@/lib/email";

const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { programId, programSlug } = body ?? {};

  if (!programId || !programSlug) {
    return NextResponse.json(
      { error: "programId and programSlug are required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date();

  // ── Compute isNewMember ──────────────────────────────────────────────────
  // true if this is their first SessionAttendance record of any kind
  const priorCount = await db.sessionAttendance.count({ where: { userId } });
  const isNewMember = priorCount === 0;

  // ── Compute returningAfterAbsence ────────────────────────────────────────
  // true if their most recent attendance was 6+ weeks ago
  let returningAfterAbsence = false;
  if (!isNewMember) {
    const lastRecord = await db.sessionAttendance.findFirst({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      select: { joinedAt: true },
    });
    if (lastRecord && now.getTime() - lastRecord.joinedAt.getTime() >= SIX_WEEKS_MS) {
      returningAfterAbsence = true;
    }
  }

  // ── Create attendance record ─────────────────────────────────────────────
  const record = await db.sessionAttendance.create({
    data: {
      userId,
      programId,
      programSlug,
      joinedAt: now,
      isNewMember,
      returningAfterAbsence,
    },
  });

  // ── Automated emails (disabled by default) ───────────────────────────────
  // Controlled by ENABLE_ATTENDANCE_EMAILS env var. Do not enable until copy
  // is approved by Jesse. Both emails fire-and-forget (errors are swallowed).
  if (process.env.ENABLE_ATTENDANCE_EMAILS === "true") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, preferredName: true },
    });
    if (user) {
      const name = user.preferredName || user.firstName || "there";
      if (isNewMember) {
        sendFirstTimeAttendeeEmail({ to: user.email, firstName: name }).catch(
          (e) => console.error("[attendance/join] first-time email failed:", e)
        );
      } else if (returningAfterAbsence) {
        sendReturningAfterAbsenceEmail({ to: user.email, firstName: name }).catch(
          (e) => console.error("[attendance/join] returning email failed:", e)
        );
      }
    }
  }

  return NextResponse.json({ id: record.id });
}
