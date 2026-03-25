import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";

// ─── POST /api/programs/[slug]/send-reminder ──────────────────────────────────
// Sends the program reminder email to all active registrants who haven't
// received it yet. Used by the registrar when some people registered after
// the scheduled cron already fired.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;

  // Fetch program details from Postgres
  const pgProgram = await db.program.findUnique({ where: { slug } });

  // Find all active registrants who haven't received the reminder yet
  const registrations = await db.registration.findMany({
    where: {
      programSlug: slug,
      status: { in: ["REGISTERED", "APPROVED"] },
      reminderSentAt: null,
    },
  });

  const now = new Date();
  const loc = resolveLocation(pgProgram?.venue, pgProgram?.locationText, pgProgram?.locationLink);
  const startIso = pgProgram?.startDatetime?.toISOString() ?? null;
  const endIso = pgProgram?.endDatetime?.toISOString() ?? null;

  for (const reg of registrations) {
    await sendReminderEmail({
      to:           reg.email,
      firstName:    reg.firstName,
      programTitle: reg.programTitle,
      programSlug:  reg.programSlug,
      dateText:     pgProgram?.dateText || buildDateLabel({
        startDatetime: startIso,
        endDatetime: endIso,
        recurrenceFreq: pgProgram?.recurrenceFreq ?? null,
        recurrenceInterval: pgProgram?.recurrenceInterval ?? null,
        recurrenceDays: pgProgram?.recurrenceDays ?? null,
      }),
      locationText: loc.emailText,
      locationLink: loc.link,
      reminderMessage: pgProgram?.reminderMessage,
    });
    await db.registration.update({
      where: { id: reg.id },
      data: { reminderSentAt: now },
    });
  }

  return NextResponse.json({ sent: registrations.length });
}
