import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { programsWithReminderInWindowQuery } from "@/lib/queries";
import { sendReminderEmail } from "@/lib/email";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";

// ─── GET /api/cron/send-reminders ─────────────────────────────────────────────
// Daily cron job (runs at 14:00 UTC via vercel.json schedule).
// Finds programs whose reminderDate falls in the past 24 hours and sends
// the reminder email to all active registrants who haven't received it yet.
//
// Vercel automatically passes CRON_SECRET as: Authorization: Bearer <secret>

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now   = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find all programs with a reminderDate in the past 24-hour window
  const programs = await sanityClient.fetch(programsWithReminderInWindowQuery, {
    since: since.toISOString(),
    now:   now.toISOString(),
  });

  let totalSent = 0;

  for (const program of (programs ?? [])) {
    // Find registrants for this program who haven't yet received the reminder
    const registrations = await db.registration.findMany({
      where: {
        programSlug: program.slug,
        status: { in: ["REGISTERED", "APPROVED"] },
        reminderSentAt: null,
      },
    });

    const loc = resolveLocation(program.venue, program.locationText, program.locationLink);

    for (const reg of registrations) {
      await sendReminderEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        programSlug:  reg.programSlug,
        dateText:     program.dateText || buildDateLabel(program),
        locationText: loc.emailText,
        locationLink: loc.link,
        zoomLink:     program.zoomLink,
        reminderMessage: program.reminderMessage,
      });
      await db.registration.update({
        where: { id: reg.id },
        data: { reminderSentAt: now },
      });
      totalSent++;
    }
  }

  console.log(`[cron] send-reminders: sent ${totalSent} emails for ${(programs ?? []).length} program(s)`);
  return NextResponse.json({ ok: true, sent: totalSent });
}
