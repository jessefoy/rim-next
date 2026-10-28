import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import { canOpenTeachingPage, isGuidingTeacher } from "@/lib/teaching";
import { programWhen } from "@/lib/registrationDesk";
import { fmtLabel } from "@/lib/programUtils";
import { loadAskerContext } from "@/lib/programAskers";
import { askerOf } from "@/lib/questionAskers";
import { answerFor, type QuestionLike } from "@/lib/registrationAnswers";
import { loadFirstRegistrationIds } from "@/lib/firstRegistration";
import { CONTACT_DAYS_AFTER, contactsClosed, hasEnded } from "@/lib/contactWindow";
import { lastOccurrenceEnd } from "@/lib/scheduleUtils";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return { title: p ? `Teaching: ${p.name} - Rooted In Mindfulness` : "Teaching - Rooted In Mindfulness" };
}

type Question = QuestionLike & { fieldType?: string; askedBy?: string };

const CHOICE_TYPES = new Set(["yesNo", "select"]);

function fmtNoteDate(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// The teacher's page (2026-10-24, Phase 3 slice 3, "Who's helping, who's
// asking"): who's coming, who is registering here for the first time, what
// people told the teacher (the questions the teacher asks), the registration
// team's notes "for the teacher too", and how to reach each person. Waiting
// names in one line (Jesse, 2026-10-24). Never dana. Open to the program's
// teachers and the guiding teacher (lib/teaching.ts); Admin alone does not
// open it.
export default async function TeachingProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      dateText: true,
      timeText: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true, recurrenceUntil: true,
      programFormat: true,
      outsideMeetingUrl: true,
      hostingHubSlug: true,
      registrationEnabled: true,
      registrationFields: true,
      archivedAt: true,
      programTeachers: { where: { userId }, select: { id: true } },
    },
  });
  if (!program) notFound();
  if (!(await canOpenTeachingPage(userId, session.user.roles, program.id))) notFound();
  const teachesIt = program.programTeachers.length > 0;

  // 30 days after it ends, the list (with contact details) closes to its
  // teachers; the guiding teacher keeps it, as the registration team does
  // (lib/contactWindow.ts, Jesse 2026-10-26).
  if (!isGuidingTeacher(session.user.roles) && contactsClosed(program, new Date(), lastOccurrenceEnd(program))) {
    return (
      <AccountLayout>
        <div className="ac-member-page hlp-page">
          <p className="hlp-back"><Link href="/account/teaching">&larr; Teaching</Link></p>
          <header className="ac-page-head">
            <div><h1 className="ac-page-title">{program.name}</h1></div>
          </header>
          <p className="hlp-why">
            This program ended more than {CONTACT_DAYS_AFTER} days ago, so its list of who came has closed.
            The registration team still has it.
          </p>
        </div>
      </AccountLayout>
    );
  }

  const [registrations, askers] = await Promise.all([
    db.registration.findMany({
      // A held place (PENDING_PAYMENT) isn't a registration; cancelled people aren't coming.
      where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED", "WAITLISTED"] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      // Never dana, the edit link's key or the Stripe session.
      select: {
        id: true, userId: true, firstName: true, lastName: true, email: true, phone: true,
        status: true, customFields: true, createdAt: true,
      },
    }),
    loadAskerContext(program),
  ]);
  const coming = registrations.filter((r) => r.status !== "WAITLISTED");
  const waiting = registrations.filter((r) => r.status === "WAITLISTED");

  // "First registration here" (lib/firstRegistration.ts): no earlier place on
  // this site, under their account or their address.
  const firstIds = await loadFirstRegistrationIds(coming);
  const isFirst = (r: (typeof coming)[number]) => firstIds.has(r.id);
  const firstTimers = coming.filter(isFirst);

  // The registration team's notes marked for the teacher too.
  const notes = coming.length
    ? await db.registrationNote.findMany({
        where: { registrationId: { in: coming.map((r) => r.id) }, forTeacher: true },
        orderBy: { createdAt: "asc" },
        select: { registrationId: true, authorId: true, body: true, createdAt: true },
      })
    : [];
  const authors = new Map(
    (notes.some((n) => n.authorId)
      ? await db.user.findMany({
          where: { id: { in: notes.map((n) => n.authorId).filter((a): a is string => !!a) } },
          select: { id: true, firstName: true, preferredName: true },
        })
      : []
    ).map((u) => [u.id, u.preferredName || u.firstName || "The registration team"]),
  );
  const notesFor = (registrationId: string) => notes.filter((n) => n.registrationId === registrationId);

  // The questions the teacher asks (lib/questionAskers.ts).
  const questions = (Array.isArray(program.registrationFields) ? (program.registrationFields as unknown as Question[]) : [])
    .filter((q) => q && typeof q.label === "string" && askerOf(q.askedBy, askers).kind === "teacher");
  const written = questions.filter((q) => !CHOICE_TYPES.has(q.fieldType ?? ""));
  const choices = questions.filter((q) => CHOICE_TYPES.has(q.fieldType ?? ""));

  const name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  const when = programWhen(program);
  const where = fmtLabel(program.programFormat, program.outsideMeetingUrl);
  // Once it's over, said as past (2026-10-26): "1 person had a place."
  const over = !!program.archivedAt || hasEnded(program, new Date(), lastOccurrenceEnd(program));
  const people = (n: number) => (n === 1 ? "1 person is" : `${n} people are`);

  const state = !program.registrationEnabled && coming.length === 0
    ? "People don’t register for this program, so there’s no one to list here."
    : coming.length === 0
      ? waiting.length > 0
        ? "No one has a place yet."
        : "No one has registered yet."
      : over
        ? `${coming.length === 1 ? "1 person" : `${coming.length} people`} had a place.`
        : `${people(coming.length)} coming.`;

  return (
    <AccountLayout>
      <div className="ac-member-page hlp-page">
        <p className="hlp-back"><Link href="/account/teaching">&larr; Teaching</Link></p>
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">{program.name}</h1>
            <p className="ac-page-sub">{[when, program.timeText, where].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        <p className="hlp-state">{state}</p>
        <p className="hlp-why">
          {teachesIt || !isGuidingTeacher(session.user.roles)
            ? "You see this because you teach this program."
            : "You see this because you’re the guiding teacher."}{" "}
          It shows who&rsquo;s coming, what they told you, and how to reach them. Dana isn&rsquo;t shown here.
          {program.archivedAt ? " This program is archived." : ""}
        </p>

        {/* The heading only when someone is new (Jesse, 2026-10-26). */}
        {coming.length > 0 && firstTimers.length > 0 && (
          <section className="hlp-panel" aria-labelledby="hlp-first">
            <h2 id="hlp-first" className="hlp-panel__title">First registration here</h2>
            <p className="hlp-note">Their first registration on this site. The site doesn&rsquo;t know the old site&rsquo;s history, so some may have come before.</p>
            <p className="hlp-names">{firstTimers.map(name).join(", ")}</p>
          </section>
        )}
        {coming.length > 0 && firstTimers.length === 0 && (
          <p className="hlp-note">Everyone coming has registered here before.</p>
        )}

        {coming.length > 0 && (
          <section className="hlp-panel" aria-labelledby="hlp-told">
            <h2 id="hlp-told" className="hlp-panel__title">What they told you</h2>
            {questions.length === 0 && notes.length === 0 && (
              <p className="hlp-note">No question on the form is asked by you. The registration team can add one, or mark one as yours.</p>
            )}
            {choices.map((q) => {
              const counts = new Map<string, string[]>();
              for (const r of coming) {
                const a = answerFor(r.customFields, q).trim();
                if (!a) continue;
                counts.set(a, [...(counts.get(a) ?? []), name(r)]);
              }
              return (
                <div key={q._key ?? q.label} className="hlp-question">
                  <h3 className="hlp-question__label">{q.label}</h3>
                  {counts.size === 0 ? (
                    <p className="hlp-note">No one has answered yet.</p>
                  ) : (
                    <ul className="hlp-counts">
                      {[...counts.entries()].map(([answer, names]) => (
                        <li key={answer}>
                          <strong>{answer}: {names.length}</strong> <span className="hlp-counts__names">{names.join(", ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {written.map((q) => {
              const answers = coming
                .map((r) => ({ who: name(r), text: answerFor(r.customFields, q).trim() }))
                .filter((a) => a.text);
              return (
                <div key={q._key ?? q.label} className="hlp-question">
                  <h3 className="hlp-question__label">{q.label}</h3>
                  {answers.length === 0 ? (
                    <p className="hlp-note">No one has answered yet.</p>
                  ) : (
                    <ul className="hlp-answers">
                      {answers.map((a, i) => (
                        <li key={i}><strong>{a.who}:</strong> {a.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {notes.length > 0 && (
              <div className="hlp-question">
                <h3 className="hlp-question__label">Notes from the registration team</h3>
                <ul className="hlp-answers">
                  {notes.map((n, i) => {
                    const r = coming.find((c) => c.id === n.registrationId);
                    return (
                      <li key={i}>
                        <strong>{r ? name(r) : "Someone coming"}:</strong> {n.body}{" "}
                        <span className="hlp-meta">({n.authorId ? authors.get(n.authorId) ?? "The registration team" : "The registration team"}, {fmtNoteDate(n.createdAt)})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {(coming.length > 0 || waiting.length > 0) && (
          <section className="hlp-panel" aria-labelledby="hlp-everyone">
            <h2 id="hlp-everyone" className="hlp-panel__title">Everyone coming</h2>
            {coming.length > 0 && <p className="hlp-note">Open a name for their email, phone and what they told you.</p>}
            {coming.length > 0 && <ul className="hlp-people">
              {coming.map((r) => {
                const mine = questions.map((q) => ({ q, a: answerFor(r.customFields, q).trim() })).filter((x) => x.a);
                const theirNotes = notesFor(r.id);
                return (
                  <li key={r.id}>
                    <details className="hlp-person">
                      <summary>
                        {name(r)}
                        {isFirst(r) && <span className="hlp-mark">First registration here</span>}
                      </summary>
                      <div className="hlp-person__body">
                        <p className="hlp-contact">
                          <a href={`mailto:${r.email}`}>{r.email}</a>
                          {r.phone && <> &middot; <a href={telHref(r.phone)}>{formatPhone(r.phone)}</a></>}
                        </p>
                        {mine.map(({ q, a }) => (
                          <p key={q._key ?? q.label} className="hlp-told"><span className="hlp-told__q">{q.label}</span> {a}</p>
                        ))}
                        {theirNotes.map((n, i) => (
                          <p key={i} className="hlp-told">
                            <span className="hlp-told__q">A note from the registration team</span> {n.body}
                          </p>
                        ))}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>}
            {waiting.length > 0 && (
              <p className="hlp-note hlp-waiting">Waiting for a place: {waiting.map(name).join(", ")}.</p>
            )}
          </section>
        )}
      </div>
    </AccountLayout>
  );
}
