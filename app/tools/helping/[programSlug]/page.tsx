import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { helpingTeamAccess } from "@/lib/programHelpers";
import { programWhen } from "@/lib/registrationDesk";
import { fmtLabel } from "@/lib/programUtils";
import { loadAskerContext } from "@/lib/programAskers";
import { askerOf } from "@/lib/questionAskers";
import { answerFor, type QuestionLike } from "@/lib/registrationAnswers";
import { CONTACT_DAYS_AFTER, contactsClosed, hasEnded } from "@/lib/contactWindow";
import { formatPhone } from "@/lib/phone";
import { lastOccurrenceEnd } from "@/lib/scheduleUtils";
import { isGuidingTeacher } from "@/lib/teaching";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ programSlug: string }> }) {
  const { programSlug } = await params;
  const p = await db.program.findUnique({ where: { slug: programSlug }, select: { name: true } });
  return { title: p ? `Helping with: ${p.name} - Tools` : "Helping with - Tools" };
}

type Question = QuestionLike & { fieldType?: string; askedBy?: string };
const CHOICE_TYPES = new Set(["yesNo", "select"]);

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// A program as a team that prepares sees it (2026-10-24, Phase 3 slice 5):
// how many are coming, the answers to the team's own questions with names
// (choices counted), and everyone coming; email and phone only when the
// program lets this team reach people. Never dana, never others' questions.
// The team comes from ?hub= (helpingTeamAccess) and must be one of this
// program's teams that prepare.
export default async function HelpingProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ hub?: string }>;
}) {
  const { programSlug } = await params;
  const { hub } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const team = await helpingTeamAccess(session.user.id, session.user.roles, hub);
  if (!team) notFound();
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true, slug: true, name: true, dateText: true, startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true, recurrenceUntil: true, programFormat: true,
      outsideMeetingUrl: true, hostingHubSlug: true, registrationEnabled: true, registrationFields: true, archivedAt: true,
    },
  });
  if (!program) notFound();
  const helper = await db.programHelper.findUnique({
    where: { programId_hubId: { programId: program.id, hubId: team.id } },
    select: { canReach: true },
  });
  if (!helper) notFound();

  // 30 days after it ends, the list (with any contact details) closes to the
  // team; the guiding teacher keeps it, as the registration team does
  // (lib/contactWindow.ts, Jesse 2026-10-26).
  if (!isGuidingTeacher(session.user.roles) && contactsClosed(program, new Date(), lastOccurrenceEnd(program))) {
    return (
      <div className="vol-page">
        <div className="vol-content hlp-page">
          <p className="hlp-back"><Link href={`/tools/helping?hub=${encodeURIComponent(team.slug)}`}>&larr; Helping with</Link></p>
          <h1 className="vol-header__title">{program.name}</h1>
          <p className="hlp-why">
            This program ended more than {CONTACT_DAYS_AFTER} days ago, so its list of who came has closed.
            The registration team still has it.
          </p>
        </div>
      </div>
    );
  }

  const [registrations, askers] = await Promise.all([
    db.registration.findMany({
      where: { programSlug: program.slug, status: { in: ["REGISTERED", "APPROVED"] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      // Contact details only when this team may reach people; never dana.
      select: {
        id: true, firstName: true, lastName: true, customFields: true,
        ...(helper.canReach ? { email: true, phone: true } : {}),
      },
    }),
    loadAskerContext(program),
  ]);

  const questions = (Array.isArray(program.registrationFields) ? (program.registrationFields as unknown as Question[]) : [])
    .filter((q) => {
      if (!q || typeof q.label !== "string") return false;
      const a = askerOf(q.askedBy, askers);
      return a.kind === "team" && a.hubId === team.id;
    });
  const name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  const qs = `?hub=${encodeURIComponent(team.slug)}`;
  const when = programWhen(program);
  const where = fmtLabel(program.programFormat, program.outsideMeetingUrl);
  const n = registrations.length;
  // Once it's over, said as past (2026-10-26).
  const over = !!program.archivedAt || hasEnded(program, new Date(), lastOccurrenceEnd(program));

  return (
    <div className="vol-page">
      <div className="vol-content hlp-page">
        <p className="hlp-back"><Link href={`/tools/helping${qs}`}>&larr; Helping with</Link></p>
        <h1 className="vol-header__title">{program.name}</h1>
        <p className="hlp-sub">{[when, where].filter(Boolean).join(" · ")}</p>
        <p className="hlp-state">
          {!program.registrationEnabled && n === 0
            ? "People don’t register for this program, so there’s no one to count."
            : n === 0
              ? "No one has registered yet."
              : over
                ? `${n === 1 ? "1 person" : `${n} people`} had a place.`
                : `${n === 1 ? "1 person is" : `${n} people are`} coming.`}
        </p>
        <p className="hlp-why">
          You see this because the {team.name} prepares for this program. It shows how many are coming and what they told the team
          {helper.canReach ? ", and how to reach them" : ""}. Dana isn&rsquo;t shown here.
          {program.archivedAt ? " This program is archived." : ""}
        </p>

        {n > 0 && (
          <section className="hlp-panel" aria-labelledby="hlp-told">
            <h2 id="hlp-told" className="hlp-panel__title">What they told the {team.name}</h2>
            {questions.length === 0 && (
              <p className="hlp-note">No question on the form is asked by this team. The program&rsquo;s editor can add one, asked by the {team.name}.</p>
            )}
            {questions.map((q) => {
              if (CHOICE_TYPES.has(q.fieldType ?? "")) {
                const counts = new Map<string, string[]>();
                for (const r of registrations) {
                  const a = answerFor(r.customFields, q).trim();
                  if (a) counts.set(a, [...(counts.get(a) ?? []), name(r)]);
                }
                return (
                  <div key={q._key ?? q.label} className="hlp-question">
                    <h3 className="hlp-question__label">{q.label}</h3>
                    {counts.size === 0 ? (
                      <p className="hlp-note">No one has answered yet.</p>
                    ) : (
                      <ul className="hlp-counts">
                        {[...counts.entries()].map(([answer, names]) => (
                          <li key={answer}><strong>{answer}: {names.length}</strong> <span className="hlp-counts__names">{names.join(", ")}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              const answers = registrations
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
          </section>
        )}

        {n > 0 && (
          <section className="hlp-panel" aria-labelledby="hlp-everyone">
            <h2 id="hlp-everyone" className="hlp-panel__title">Everyone coming</h2>
            {helper.canReach ? (
              <ul className="hlp-people">
                {registrations.map((r) => {
                  const contact = r as typeof r & { email?: string; phone?: string | null };
                  return (
                    <li key={r.id}>
                      <details className="hlp-person">
                        <summary>{name(r)}</summary>
                        <div className="hlp-person__body">
                          <p className="hlp-contact">
                            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                            {contact.phone && <> &middot; <a href={telHref(contact.phone)}>{formatPhone(contact.phone)}</a></>}
                          </p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hlp-names">{registrations.map(name).join(", ")}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
