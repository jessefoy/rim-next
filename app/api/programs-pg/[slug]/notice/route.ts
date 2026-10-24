import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { parseAnnouncementUntil } from "@/lib/scheduleUtils";
import { toCentralDatetime } from "@/lib/timezone";
import { sendEachPaced, sendProgramNoticeEmail } from "@/lib/email";
import { recordRegistrationEvent } from "@/lib/registrationEvents";

// ─── POST /api/programs-pg/[slug]/notice ─────────────────────────────────────
// The program editor's "Post a notice" (2026-10-24, Phase 2): writes the
// program's notice (`specialAnnouncement`) and its last day
// (`announcementUntil`), and nothing else, so none of the editor save's side
// effects run. An empty notice takes it down. Anyone who can open Programs
// may post; "Also email the people registered" is for those who can open
// Registration (canUseRegistration), as Message people is: it goes to everyone
// with a place, not the waiting list, one at a time after the response, capped
// like Message people.

export const maxDuration = 300;

const MAX_PEOPLE = 50;
const MAX_NOTICE = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to post." }, { status: 400 });
  }
  // One line: a notice shows as one line everywhere and goes into an email's
  // subject, so line breaks become spaces.
  const notice = typeof body.notice === "string" ? body.notice.replace(/\s+/g, " ").trim() : "";
  const email = body.email === true;
  const until = notice ? parseAnnouncementUntil(body.until) : null;
  if (until === undefined) {
    return NextResponse.json({ error: "Show until must be a date, or empty." }, { status: 422 });
  }
  // A last day already behind us would hide it at once (activeAnnouncement).
  if (until && until.toISOString().slice(0, 10) < toCentralDatetime(new Date()).slice(0, 10)) {
    return NextResponse.json({ error: "That Show until day has already passed. Choose today or a later day, or leave it empty." }, { status: 422 });
  }
  if (email && !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Only the registration team can email the people registered." }, { status: 403 });
  }
  if (email && !notice) {
    return NextResponse.json({ error: "Write the notice to email it." }, { status: 422 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, archivedAt: true, specialAnnouncement: true },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  // The limit is for new words: a longer notice from before it stays postable.
  if (notice.length > MAX_NOTICE && notice !== program.specialAnnouncement?.replace(/\s+/g, " ").trim()) {
    return NextResponse.json({ error: `A notice can be up to ${MAX_NOTICE} characters. Keep it to a line or two.` }, { status: 422 });
  }
  if (program.archivedAt) {
    return NextResponse.json({ error: "This program is archived, so a notice wouldn't show anywhere." }, { status: 409 });
  }

  // Who it emails, settled before anything is written.
  let people: { id: string; email: string; firstName: string }[] = [];
  if (email) {
    const rows = await db.registration.findMany({
      where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true },
    });
    const seen = new Set<string>();
    people = rows.filter((r) => {
      const key = r.email.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (people.length > MAX_PEOPLE) {
      return NextResponse.json(
        { error: `That's ${people.length} people, more than ${MAX_PEOPLE} can be emailed here. Post the notice without the email, and use the program's Flodesk segment for a group this size.` },
        { status: 400 },
      );
    }
  }

  await db.program.update({
    where: { id: program.id },
    data: { specialAnnouncement: notice || null, announcementUntil: until },
  });
  await recordRegistrationEvent({
    kind: "notice-posted",
    programId: program.id,
    programSlug: program.slug,
    actorId: session.user.id,
    detail: { notice, until: until?.toISOString() ?? null, count: people.length },
  });

  if (people.length > 0) {
    const programTitle = program.name;
    const programSlug = program.slug;
    after(async () => {
      await sendEachPaced(
        people,
        (p) => sendProgramNoticeEmail({ to: p.email, firstName: p.firstName, programTitle, programSlug, notice }),
        "program-notice",
      );
    });
  }

  return NextResponse.json({ ok: true, count: people.length });
}
