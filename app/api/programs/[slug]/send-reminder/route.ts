import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { programReminderDataQuery } from "@/lib/queries";
import { sendReminderEmail } from "@/lib/email";
import { resolveLocation } from "@/lib/locations";

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

  // Fetch program details from Sanity (reminder message + schedule info)
  const data = await sanityClient.fetch(programReminderDataQuery, { slug });

  // Find all active registrants who haven't received the reminder yet
  const registrations = await db.registration.findMany({
    where: {
      programSlug: slug,
      status: { in: ["REGISTERED", "APPROVED"] },
      reminderSentAt: null,
    },
  });

  const now = new Date();
  const loc = resolveLocation(data?.venue, data?.locationText, data?.locationLink);

  for (const reg of registrations) {
    await sendReminderEmail({
      to:           reg.email,
      firstName:    reg.firstName,
      programTitle: reg.programTitle,
      programSlug:  reg.programSlug,
      dateText:     data?.dateText,
      locationText: loc.emailText,
      locationLink: loc.link,
      zoomLink:     data?.zoomLink,
      reminderMessage: data?.reminderMessage,
    });
    await db.registration.update({
      where: { id: reg.id },
      data: { reminderSentAt: now },
    });
  }

  return NextResponse.json({ sent: registrations.length });
}
