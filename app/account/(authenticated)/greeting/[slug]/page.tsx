import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import ArrivalList, { type ArrivalPerson } from "@/components/helpers/ArrivalList";
import { cleanDay, sessionTeamAccess } from "@/lib/sessionHelpers";
import { getHubCoverageCopy } from "@/lib/programHub";
import { loadAskerContext } from "@/lib/programAskers";
import { askerOf } from "@/lib/questionAskers";
import { answerFor, type QuestionLike } from "@/lib/registrationAnswers";
import { nextOccurrenceOnOrAfter, shiftToDate } from "@/lib/scheduleUtils";
import { toCentralDatetime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return { title: p ? `Today's list: ${p.name} - Rooted In Mindfulness` : "Today's list - Rooted In Mindfulness" };
}

type Question = QuestionLike & { fieldType?: string; askedBy?: string };

function fmtDayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
}

// A supporting team's page for one session (2026-10-24, Phase 3 slice 4,
// "Who's helping, who's asking"): the greeters' list, or any supporting
// team's. Who's registered, their answers to this team's own questions, and an
// Arrived button for each. No contact details, no dana. Who may open it:
// lib/sessionHelpers.ts. Reached from the duty line on My Home ("Today's
// list", Jesse 2026-10-24).
export default async function SessionTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; team?: string }>;
}) {
  const { slug } = await params;
  const { date, team } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, startDatetime: true, programFormat: true, hostingHubSlug: true,
      registrationEnabled: true, registrationFields: true, archivedAt: true,
      endDatetime: true, recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true, recurrenceUntil: true,
    },
  });
  if (!program) notFound();
  // Without a day (a saved link): the program's next session, from today on
  // (Jesse, 2026-10-26); today if it has none ahead.
  const today = toCentralDatetime(new Date()).slice(0, 10);
  const day = cleanDay(date) ?? nextOccurrenceOnOrAfter(program, today) ?? today;
  const access = await sessionTeamAccess(session.user.id, session.user.roles, program, day, team ?? null);
  if (!access) notFound();

  const [registrations, arrivals, askers, copy] = await Promise.all([
    db.registration.findMany({
      // People with a place; never their contact details or dana.
      where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED"] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, customFields: true },
    }),
    db.registrationAttendance.findMany({ where: { programId: program.id, day }, select: { registrationId: true } }),
    loadAskerContext(program),
    getHubCoverageCopy(access.hub.slug),
  ]);

  // This team's own questions (lib/questionAskers.ts).
  const questions = (Array.isArray(program.registrationFields) ? (program.registrationFields as unknown as Question[]) : [])
    .filter((q) => {
      if (!q || typeof q.label !== "string") return false;
      const a = askerOf(q.askedBy, askers);
      return a.kind === "team" && a.hubId === access.hub.id;
    });
  const arrivedIds = new Set(arrivals.map((a) => a.registrationId));
  const people: ArrivalPerson[] = registrations.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    answers: questions
      .map((q) => ({ label: q.label, value: answerFor(r.customFields, q).trim() }))
      .filter((a) => a.value),
    arrived: arrivedIds.has(r.id),
  }));

  const time = program.startDatetime
    ? shiftToDate(program.startDatetime.toISOString(), day).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })
    : null;
  const why =
    access.why === "assigned"
      ? `You see this because you’re ${copy.verb} this session.`
      : access.why === "coordinator"
        ? `You see this because you lead the ${access.hub.name}.`
        : "You see this because you’re the guiding teacher.";

  return (
    <AccountLayout>
      <div className="ac-member-page hlp-page">
        <p className="hlp-back"><Link href="/account/dashboard">&larr; My Home</Link></p>
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">{program.name}</h1>
            <p className="ac-page-sub">{[fmtDayLong(day), time].filter(Boolean).join(" · ")} &middot; For the {access.hub.name}</p>
          </div>
        </header>
        <p className="hlp-why">
          {why} It shows who&rsquo;s registered and lets you mark them arrived. Contact details and dana aren&rsquo;t shown here.
          {program.archivedAt ? " This program is archived." : ""}
        </p>

        {!program.registrationEnabled && people.length === 0 ? (
          <section className="hlp-panel">
            <p className="hlp-state">People don&rsquo;t register for this program, so there&rsquo;s no list. Welcome everyone who comes.</p>
          </section>
        ) : people.length === 0 ? (
          <section className="hlp-panel">
            <p className="hlp-state">No one is registered for this session.</p>
          </section>
        ) : (
          <section className="hlp-panel" aria-label="Who's registered">
            <ArrivalList programSlug={program.slug} day={day} team={access.hub.slug} people={people} />
          </section>
        )}
        {program.registrationEnabled && (
          <p className="hlp-note">Someone not on the list? Welcome them, and tell the registration team their name.</p>
        )}
      </div>
    </AccountLayout>
  );
}
