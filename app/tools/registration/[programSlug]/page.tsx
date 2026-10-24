/**
 * /tools/registration/[programSlug] — one program's people (2026-10-23).
 * Opens on what needs a person, then the people, their notes and the
 * program's history. It replaced the Program Manager's roster (whose address,
 * /tools/programs/[slug], redirects here), through the same APIs.
 * Gate: canUseRegistration (also in the layout).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canSeeDanaAmounts, canUseProgramManager, canUseRegistration } from "@/lib/toolAuth";
import { describeRegistrationEvent, SELF_EVENT_KINDS, staffName } from "@/lib/registrationEvents";
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
import RegistrationSettings from "@/components/registration/RegistrationSettings";
import { programUsesFlodesk } from "@/lib/flodeskRules";
import { toCentralDatetime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ programSlug: string }> }) {
  const { programSlug } = await params;
  const p = await db.program.findUnique({ where: { slug: programSlug }, select: { name: true } });
  return { title: p ? `${p.name} - Registration` : "Registration - Tools" };
}

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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The people a program-wide event reached (a message), from its detail. */
function idsIn(detail: unknown): string[] {
  const ids = detail && typeof detail === "object" ? (detail as Record<string, unknown>).registrationIds : null;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
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
      danaFixedAmount: true,
      danaBaseAmount: true,
      archivedAt: true,
      updatedAt: true,
      offeringCategory: true,
      flodeskSync: true,
      flodeskSegmentName: true,
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

  const [notes, events, heldPlaces] = await Promise.all([
    ids.length
      ? db.registrationNote.findMany({ where: { registrationId: { in: ids } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    db.registrationEvent.findMany({ where: { programSlug }, orderBy: { createdAt: "desc" }, take: 300 }),
    // A place held for someone paying is taken, as the public form counts it.
    db.registration.count({ where: { programSlug, status: "PENDING_PAYMENT" } }),
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
  // Someone added from the app has that line instead of a sign-up line.
  const addedIds = new Set(events.filter((e) => e.kind === "added" && e.registrationId).map((e) => e.registrationId as string));
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
      forIds: idsIn(e.detail),
      person: e.registrationId ? nameById.get(e.registrationId) ?? null : null,
      // What the person did reads under their own name; the rest names who did it.
      text: SELF_EVENT_KINDS.includes(e.kind)
        ? capitalize(describeRegistrationEvent(e.kind, e.detail))
        : `${nameOf(e.actorId)} ${describeRegistrationEvent(e.kind, e.detail)}`,
    })),
    ...registrations.filter((r) => !addedIds.has(r.id)).map((r) => ({
      id: `registered-${r.id}`,
      at: r.createdAt.toISOString(),
      when: fmtWhen(r.createdAt),
      registrationId: r.id,
      forIds: [],
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

  // The settings fold, for a program taking registration.
  const mailingListByDefault = programUsesFlodesk({ ...program, flodeskSync: null });
  const mailingListOn = programUsesFlodesk(program);
  const settingsPanel = !program.archivedAt && program.registrationEnabled ? (
    <RegistrationSettings
      programSlug={program.slug}
      updatedAt={program.updatedAt.toISOString()}
      initial={{
        closed: program.registrationClosed,
        places: program.registrationCapacity ? String(program.registrationCapacity) : "",
        closes: toCentralDatetime(program.registrationDeadline),
        mailingList: program.flodeskSync,
      }}
      summary={[
        registrationState(program),
        program.registrationCapacity ? `${program.registrationCapacity} places` : "no limit on places",
        `mailing list ${mailingListOn ? "on" : "off"}`,
      ].filter(Boolean).join(" · ")}
      taken={counts.registered + heldPlaces}
      waiting={counts.waiting}
      mailingListByDefault={mailingListByDefault}
      segmentName={program.flodeskSegmentName}
      editHref={canUseProgramManager(roles) ? `/tools/programs/${program.slug}/edit${hubQs}` : null}
    />
  ) : null;

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href={`/tools/registration${hubQs}`} className="vol-back">&larr; All programs</Link>
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
          settingsPanel={settingsPanel}
          programSlug={program.slug}
          people={people}
          history={history}
          needs={needs}
          registrationFields={fields}
          danaMode={program.danaMode}
          programName={program.name}
          signInHref={`/tools/registration/${program.slug}/sign-in${hubQs}`}
          canAdd={!program.archivedAt && program.registrationEnabled}
          full={!!program.registrationCapacity && counts.registered + heldPlaces >= program.registrationCapacity}
          asksDana={
            program.danaMode === "voluntary" ||
            (program.danaMode === "fixed" && (program.danaFixedAmount ?? 0) > 0) ||
            (program.danaMode === "base_plus_dana" && (program.danaBaseAmount ?? 0) > 0)
          }
          reminderDay={program.reminderDate ? fmtDay(program.reminderDate) : null}
          seeAmounts={seeAmounts}
          initialShow={show ?? null}
        />
      </div>
    </div>
  );
}
