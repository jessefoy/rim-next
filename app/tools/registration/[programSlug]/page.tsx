/**
 * /tools/registration/[programSlug] — one program's people (2026-10-23).
 * Opens on what needs a person, then the people, their notes and the
 * program's history. Every action goes through the same APIs as the
 * Program Manager's roster, which keeps working beside it until this page
 * replaces it. Gate: canUseRegistration (also in the layout).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canSeeDanaAmounts, canUseProgramManager, canUseRegistration } from "@/lib/toolAuth";
import { describeRegistrationEvent, staffName } from "@/lib/registrationEvents";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";
import { fmtLabel } from "@/lib/programUtils";
import {
  fmtDay,
  fmtWhen,
  placesLine,
  programNeeds,
  programWhen,
  registrationState,
  type DeskCounts,
} from "@/lib/registrationDesk";
import RegistrationPeople, {
  type PeopleRow,
  type HistoryRow,
} from "@/components/registration/RegistrationPeople";
import type { RegistrationField } from "@/components/RegistrationForm";

export const dynamic = "force-dynamic";

/** The older single notes field, as plain text: it was Tiptap HTML or BlockNote JSON. */
function earlierNoteText(notes: unknown): string | null {
  if (notes === null || notes === undefined) return null;
  const html = typeof notes === "string" ? notes : renderBlockNoteHtml(notes) || "";
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** Their answers, then any of the program's questions they left empty. */
function answersFor(customFields: unknown, fields: RegistrationField[]) {
  const given = (customFields as Record<string, unknown> | null) ?? {};
  const answers = Object.entries(given).map(([label, value]) => ({
    label,
    value: value === null || value === undefined ? "" : String(value),
  }));
  for (const f of fields) {
    if (f.label && !(f.label in given)) answers.push({ label: f.label, value: "" });
  }
  return answers;
}

export default async function RegistrationProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ hub?: string; show?: string }>;
}) {
  const { programSlug } = await params;
  const { hub, show } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");
  if (!canUseRegistration(session.user.roles)) notFound();

  const roles = session.user.roles ?? [];
  const seeAmounts = canSeeDanaAmounts(roles);
  const hubQs = hub ? `?hub=${encodeURIComponent(hub)}` : "";

  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      dateText: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      programFormat: true,
      outsideMeetingUrl: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationCapacity: true,
      registrationDeadline: true,
      registrationFields: true,
      reminderDate: true,
      danaMode: true,
      archivedAt: true,
    },
  });
  if (!program) notFound();

  const registrations = await db.registration.findMany({
    // A held place (PENDING_PAYMENT) is not a registration until dana is given.
    where: { programSlug, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "asc" },
    // Never the edit link's key or the Stripe session.
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      waitlistPosition: true,
      donationStatus: true,
      donationAmount: true,
      customFields: true,
      notes: true,
      reminderSentAt: true,
      createdAt: true,
    },
  });
  const ids = registrations.map((r) => r.id);
  const fields = (program.registrationFields as RegistrationField[] | null) ?? [];

  const [notes, events] = await Promise.all([
    ids.length
      ? db.registrationNote.findMany({ where: { registrationId: { in: ids } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    db.registrationEvent.findMany({ where: { programSlug }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  const staffIds = [
    ...new Set([...notes.map((n) => n.authorId), ...events.map((e) => e.actorId)].filter((x): x is string => !!x)),
  ];
  const staff = staffIds.length
    ? await db.user.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const nameOf = (id: string | null) => (id ? staffName(staff.find((s) => s.id === id)) : "RIM");

  const people: PeopleRow[] = registrations.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    firstName: r.firstName,
    email: r.email,
    phone: r.phone,
    status: r.status,
    waitlistPosition: r.waitlistPosition,
    donationStatus: r.donationStatus,
    donationCents: seeAmounts ? r.donationAmount : null,
    answers: answersFor(r.customFields, fields),
    answered: Object.keys((r.customFields as Record<string, unknown> | null) ?? {}),
    earlierNote: earlierNoteText(r.notes),
    notes: notes
      .filter((n) => n.registrationId === r.id)
      .map((n) => ({ id: n.id, body: n.body, authorName: nameOf(n.authorId), when: fmtWhen(n.createdAt) })),
    reminderSentOn: r.reminderSentAt ? fmtDay(r.reminderSentAt) : null,
    registeredOn: fmtDay(r.createdAt),
  }));

  // History: what people did, with each registration's own sign-up moment.
  // Someone offered a place since still joined by waiting.
  const joinedWaiting = new Set(registrations.filter((r) => r.status === "WAITLISTED").map((r) => r.id));
  for (const e of events) {
    const d = e.detail && typeof e.detail === "object" ? (e.detail as Record<string, unknown>) : {};
    if (e.kind === "status-changed" && d.from === "WAITLISTED" && e.registrationId) joinedWaiting.add(e.registrationId);
  }
  const nameById = new Map(registrations.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()]));
  const history: HistoryRow[] = [
    ...events.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      when: fmtWhen(e.createdAt),
      registrationId: e.registrationId,
      person: e.registrationId ? nameById.get(e.registrationId) ?? null : null,
      text: `${nameOf(e.actorId)} ${describeRegistrationEvent(e.kind, e.detail)}`,
    })),
    ...registrations.map((r) => ({
      id: `registered-${r.id}`,
      at: r.createdAt.toISOString(),
      when: fmtWhen(r.createdAt),
      registrationId: r.id,
      person: nameById.get(r.id) ?? null,
      text: joinedWaiting.has(r.id) ? "Joined the waiting list" : "Registered",
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const counts: DeskCounts = {
    registered: registrations.filter((r) => r.status === "REGISTERED" || r.status === "APPROVED").length,
    waiting: registrations.filter((r) => r.status === "WAITLISTED").length,
    danaNotFinished: registrations.filter(
      (r) => r.donationStatus === "PENDING" && (r.status === "REGISTERED" || r.status === "APPROVED"),
    ).length,
    reminderUnsent: registrations.filter(
      (r) => !r.reminderSentAt && (r.status === "REGISTERED" || r.status === "APPROVED"),
    ).length,
  };
  const needs = program.archivedAt ? [] : programNeeds(program, counts);
  const when = programWhen(program);
  const where = fmtLabel(program.programFormat, program.outsideMeetingUrl);

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href={`/tools/registration${hubQs}`} className="vol-back">&larr; Registration</Link>
          <h1 className="vol-header__title">{program.name}</h1>
          <p className="reg-state">
            <strong>{program.archivedAt ? "Archived" : registrationState(program)}</strong>
            {" · "}
            {placesLine(program, counts)}
          </p>
          <p className="reg-meta">
            {[when, where].filter(Boolean).join(" · ")}
            {canUseProgramManager(roles) && (
              <>
                {when || where ? " · " : ""}
                <Link href={`/tools/programs/${program.slug}/edit${hubQs}`} className="reg-link">
                  Change the program or its registration settings
                </Link>
              </>
            )}
          </p>
        </div>

        <RegistrationPeople
          programSlug={program.slug}
          people={people}
          history={history}
          needs={needs}
          registrationFields={fields}
          danaMode={program.danaMode}
          reminderDay={program.reminderDate ? fmtDay(program.reminderDate) : null}
          seeAmounts={seeAmounts}
          initialShow={show ?? null}
        />
      </div>
    </div>
  );
}
