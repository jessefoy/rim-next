import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { emailLocationFor } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { recordRegistrationEvent } from "@/lib/registrationEvents";
import { reminderDueAt } from "@/lib/reminderSchedule";

// ─── GET /api/cron/send-reminders ─────────────────────────────────────────────
// Daily cron job (runs at 14:00 UTC via vercel.json schedule). Sends each
// program's reminder to everyone with a place who hasn't had it, when the
// reminder is due (lib/reminderSchedule.ts): for "days before", from the send
// day until the program begins, so people who register late get it too; for
// an older program's set date, in the run after it (as before). Archived
// programs and programs with registration off are skipped.
//
// Vercel automatically passes CRON_SECRET as: Authorization: Bearer <secret>

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Candidates: registration on, not archived, with a reminder of either kind
  // and a first session not long past; the rule decides which are due.
  const candidates = await db.program.findMany({
    where: {
      registrationEnabled: true,
      archivedAt: null,
      OR: [
        { reminderDaysBefore: { not: null }, startDatetime: { gt: now } },
        { reminderDate: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now } },
      ],
    },
  });
  const programs = candidates.filter((p) => reminderDueAt(p, now));

  let totalSent = 0;

  for (const program of programs) {
    // Registrants with a place who haven't yet received the reminder
    const registrations = await db.registration.findMany({
      where: {
        programSlug: program.slug,
        status: { in: ["REGISTERED", "APPROVED"] },
        reminderSentAt: null,
      },
    });

    const loc = emailLocationFor(program);
    const startIso = program.startDatetime?.toISOString() ?? null;
    const endIso = program.endDatetime?.toISOString() ?? null;

    for (const reg of registrations) {
      await sendReminderEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        programSlug:  reg.programSlug,
        dateText:     program.dateText || buildDateLabel({
          startDatetime: startIso,
          endDatetime: endIso,
          recurrenceFreq: program.recurrenceFreq,
          recurrenceInterval: program.recurrenceInterval,
          recurrenceDays: program.recurrenceDays,
        }),
        locationText: loc.emailText,
        locationLink: loc.link,
        reminderMessage: program.reminderMessage,
      });
      await db.registration.update({
        where: { id: reg.id },
        data: { reminderSentAt: now },
      });
      totalSent++;
    }
    if (registrations.length > 0) {
      await recordRegistrationEvent({
        kind: "reminders-sent",
        programId: program.id,
        programSlug: program.slug,
        detail: { count: registrations.length, scheduled: true, registrationIds: registrations.map((r) => r.id) },
      });
    }
  }

  console.log(`[cron] send-reminders: sent ${totalSent} emails for ${programs.length} program(s)`);
  return NextResponse.json({ ok: true, sent: totalSent });
}
