import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendFollowUpEmail } from "@/lib/email";
import { recordRegistrationEvent } from "@/lib/registrationEvents";
import { followUpDueAt } from "@/lib/followUp";

// ─── GET /api/cron/send-follow-ups ────────────────────────────────────────────
// Daily (15:00 UTC, vercel.json). The note after a one-time program ends
// (lib/followUp.ts): the day after its last day (or either of the two after,
// if a run was missed), once to each person who had a place
// (Registration.followUpSentAt). Never for a recurring program or one archived
// before it ended.
//
// Vercel automatically passes CRON_SECRET as: Authorization: Bearer <secret>

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();

  // Candidates: turned on, one-time, ending (or, with no end, starting)
  // within the last two weeks; the rule decides which are due today.
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const candidates = await db.program.findMany({
    where: {
      followUpEnabled: true,
      recurrenceFreq: null,
      OR: [
        { endDatetime: { gte: cutoff } },
        { endDatetime: null, startDatetime: { gte: cutoff } },
      ],
    },
    select: {
      id: true, slug: true, name: true, followUpEnabled: true, followUpMessage: true,
      recurrenceFreq: true, startDatetime: true, endDatetime: true, archivedAt: true,
    },
  });
  const programs = candidates.filter((p) => followUpDueAt(p, now));

  let totalSent = 0;
  for (const program of programs) {
    const registrations = await db.registration.findMany({
      where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED"] }, followUpSentAt: null },
      select: { id: true, email: true, firstName: true },
    });
    const sent: string[] = [];
    for (const reg of registrations) {
      // Claim first, so two runs at once can't both send; a failed send
      // releases the claim and a later run in the window tries again.
      const claimed = await db.registration.updateMany({
        where: { id: reg.id, followUpSentAt: null },
        data: { followUpSentAt: now },
      });
      if (claimed.count !== 1) continue;
      try {
        await sendFollowUpEmail({
          to: reg.email,
          firstName: reg.firstName,
          programTitle: program.name,
          programSlug: program.slug,
          followUpMessage: program.followUpMessage,
        });
        sent.push(reg.id);
        totalSent++;
      } catch (err) {
        console.error(`[cron] send-follow-ups: ${program.slug} ${reg.id}`, err);
        await db.registration.update({ where: { id: reg.id }, data: { followUpSentAt: null } }).catch(() => {});
      }
    }
    if (sent.length > 0) {
      await recordRegistrationEvent({
        kind: "follow-up-sent",
        programId: program.id,
        programSlug: program.slug,
        detail: { count: sent.length, registrationIds: sent },
      });
    }
  }

  console.log(`[cron] send-follow-ups: sent ${totalSent} emails for ${programs.length} program(s)`);
  return NextResponse.json({ ok: true, sent: totalSent });
}
