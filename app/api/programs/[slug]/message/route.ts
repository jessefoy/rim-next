import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { sendEachPaced, sendRegistrationMessageEmail } from "@/lib/email";
import { recordRegistrationEvent } from "@/lib/registrationEvents";
import { MESSAGE_MAX_PEOPLE } from "@/lib/programUpdate";

// ─── POST /api/programs/[slug]/message ───────────────────────────────────────
// The Registration app's "Message people" (2026-10-23): one note to the people
// registered for a program, waiting for a place, or both. `test: true` sends
// it only to the person writing. Sent one at a time after the response
// (sendEachPaced, 600 ms apart), so a program is capped at MAX_PEOPLE to
// finish well inside maxDuration; a larger group belongs to the program's
// Flodesk segment. One email per address, if someone is listed twice.

// 50 people at about a second and a half each, with room to spare.
export const maxDuration = 300;

const MAX_PEOPLE = MESSAGE_MAX_PEOPLE;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10000;

type To = "registered" | "waiting" | "both";
const STATUSES: Record<To, ("REGISTERED" | "APPROVED" | "WAITLISTED")[]> = {
  registered: ["REGISTERED", "APPROVED"],
  waiting: ["WAITLISTED"],
  both: ["REGISTERED", "APPROVED", "WAITLISTED"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
  }
  const to: To = body.to === "waiting" || body.to === "both" ? body.to : "registered";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const test = body.test === true;

  if (!subject || !message) {
    return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `A subject can be up to ${MAX_SUBJECT} characters.` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `A message can be up to ${MAX_MESSAGE} characters.` }, { status: 400 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  if (test) {
    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, firstName: true, preferredName: true },
    });
    if (!me?.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    await sendRegistrationMessageEmail({
      to: me.email,
      firstName: me.preferredName || me.firstName || "there",
      programTitle: program.name,
      programSlug: program.slug,
      subject,
      message,
      test: true,
    });
    return NextResponse.json({ ok: true, test: true, email: me.email });
  }

  const rows = await db.registration.findMany({
    where: { programSlug: slug, status: { in: STATUSES[to] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, firstName: true },
  });
  const seen = new Set<string>();
  const people = rows.filter((r) => {
    const key = r.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (people.length === 0) {
    return NextResponse.json({ error: "No one is in that group." }, { status: 400 });
  }
  if (people.length > MAX_PEOPLE) {
    return NextResponse.json(
      { error: `That's ${people.length} people, more than ${MAX_PEOPLE} can be sent here. Use the program's Flodesk segment for a group this size.` },
      { status: 400 },
    );
  }

  await recordRegistrationEvent({
    kind: "message-sent",
    programId: program.id,
    programSlug: program.slug,
    actorId: session.user.id,
    detail: { to, count: people.length, subject, message, registrationIds: rows.map((p) => p.id) },
  });

  const programTitle = program.name;
  const programSlug = program.slug;
  after(async () => {
    await sendEachPaced(
      people,
      (p) => sendRegistrationMessageEmail({
        to: p.email,
        firstName: p.firstName,
        programTitle,
        programSlug,
        subject,
        message,
      }),
      "registration-message",
    );
  });

  return NextResponse.json({ ok: true, count: people.length });
}
