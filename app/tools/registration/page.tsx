/**
 * /tools/registration — the Registration app's desk (2026-10-23).
 * What needs a person across every program, then the programs taking
 * registration. Gate: canUseRegistration (also in the layout).
 * Design: mockups/registration-2026-10-23 (the desk screen), BUILD_PLAN.md.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import {
  fmtSendTime,
  isOver,
  placesLine,
  programNeeds,
  programWhen,
  registrationState,
  reminderSendsAt,
  reminderNextSend,
  type DeskCounts,
  type DeskProgram,
} from "@/lib/registrationDesk";
import { followUpSendsAt } from "@/lib/followUp";

export const metadata = { title: "Registration - Tools" };
export const dynamic = "force-dynamic";

const PROGRAM_SELECT = {
  slug: true,
  name: true,
  dateText: true,
  startDatetime: true,
  endDatetime: true,
  recurrenceFreq: true,
  recurrenceInterval: true,
  recurrenceDays: true,
  recurrenceCount: true,
  recurrenceUntil: true,
  registrationEnabled: true,
  registrationClosed: true,
  registrationCapacity: true,
  registrationDeadline: true,
  registrationOpensAt: true,
  reminderDate: true,
  reminderDaysBefore: true,
  followUpEnabled: true,
  followUpMessage: true,
  archivedAt: true,
} as const;

export default async function RegistrationDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: a page can render without its layout re-running.
  if (!canUseRegistration(session.user.roles)) notFound();

  const { hub } = await searchParams;
  const hubQs = hub ? `?hub=${encodeURIComponent(hub)}` : "";

  const [programs, byStatus, danaRows, unsentRows] = await Promise.all([
    db.program.findMany({ select: PROGRAM_SELECT, orderBy: [{ startDatetime: "asc" }, { name: "asc" }] }),
    db.registration.groupBy({
      by: ["programSlug", "status"],
      where: { status: { not: "PENDING_PAYMENT" } },
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["programSlug"],
      where: { donationStatus: "PENDING", status: { in: ["REGISTERED", "APPROVED"] } },
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["programSlug"],
      where: { reminderSentAt: null, status: { in: ["REGISTERED", "APPROVED"] } },
      _count: { _all: true },
    }),
  ]);

  const countsFor = (slug: string): DeskCounts & { any: number } => {
    const rows = byStatus.filter((r) => r.programSlug === slug);
    const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    return {
      registered: n("REGISTERED") + n("APPROVED"),
      waiting: n("WAITLISTED"),
      danaNotFinished: danaRows.find((r) => r.programSlug === slug)?._count._all ?? 0,
      reminderUnsent: unsentRows.find((r) => r.programSlug === slug)?._count._all ?? 0,
      any: rows.reduce((sum, r) => sum + r._count._all, 0),
    };
  };

  const now = new Date();
  const rows = programs.map((p) => {
    const program: DeskProgram = p;
    const counts = countsFor(p.slug);
    return {
      program,
      archived: !!p.archivedAt,
      counts,
      needs: p.archivedAt ? [] : programNeeds(program, counts, now),
      when: programWhen(program),
    };
  });

  const needs = rows.flatMap((r) =>
    r.needs.map((need) => ({ ...need, slug: r.program.slug, name: r.program.name })),
  );
  // What RIM will send by itself in the next two weeks, soonest first, so
  // nothing goes out unseen (the mockup's "Going out soon").
  const soonUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  // The reminder for programs still ahead; the note after (lib/followUp.ts)
  // goes the day after a one-time program ends, by when it's over and most
  // likely archived, so its own rule decides (Jesse, 2026-10-25).
  type GoingOut = { r: (typeof rows)[number]; at: Date; kind: "reminder" | "note" };
  const byProgram = new Map(programs.map((p) => [p.slug, p]));
  const goingOut: GoingOut[] = [
    ...rows
      .filter((r) => !r.archived && !isOver(r.program))
      // The next morning that sends it: its first day, or after that, the
      // next morning while anyone registered hasn't had it.
      .map((r) => {
        const first = reminderSendsAt(r.program);
        const at = reminderNextSend(r.program, now);
        const shown = !!at && (at.getTime() === first?.getTime() || r.counts.reminderUnsent > 0);
        return { r, at: shown ? at : null, kind: "reminder" as const };
      }),
    ...rows.map((r) => ({ r, at: followUpSendsAt(byProgram.get(r.program.slug)!), kind: "note" as const })),
  ]
    .filter((x): x is GoingOut => !!x.at && x.at > now && x.at <= soonUntil)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const taking = rows.filter((r) => r.program.registrationEnabled && !r.archived && !isOver(r.program));
  const takingSlugs = new Set(taking.map((r) => r.program.slug));
  const others = rows
    .filter((r) => !takingSlugs.has(r.program.slug) && r.counts.any > 0)
    .reverse();

  const programHref = (slug: string, show?: string) =>
    `/tools/registration/${slug}${hubQs}${show ? `${hubQs ? "&" : "?"}show=${show}` : ""}`;
  const SHOW: Record<string, string | undefined> = { place: "waiting", dana: "dana", reminder: undefined };
  const ACT: Record<string, string> = { place: "See who's waiting", dana: "See who", reminder: "Open the program" };

  return (
    <div className="vol-page">
      <div className="vol-content">
        <header className="vol-header">
          {/* Inside a team the tool's own heading already says Registration. */}
          {!hub && <h1 className="vol-header__title">Registration</h1>}
          <p className="vol-header__sub">What needs a person, then every program with registration on.</p>
        </header>

        <h2 className="reg-sectitle">Needs you</h2>
        {needs.length === 0 ? (
          <p className="reg-quiet">Nothing needs you right now.</p>
        ) : (
          <ul className="reg-list">
            {needs.map((n) => (
              <li key={`${n.slug}-${n.kind}`} className="reg-item">
                <div className="reg-item__text">
                  <span className="reg-item__prog">{n.name}</span>
                  <strong>{n.text}</strong>
                </div>
                <Link className="app-act" href={programHref(n.slug, SHOW[n.kind])}>
                  {ACT[n.kind]}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {goingOut.length > 0 && (
          <>
            <h2 className="reg-sectitle">Going out soon</h2>
            <ul className="reg-list">
              {goingOut.map(({ r, at, kind }) => (
                <li key={`${r.program.slug}-${kind}`} className="reg-item">
                  <div className="reg-item__text">
                    <span className="reg-item__prog">{r.program.name}</span>
                    {kind === "reminder" ? (
                      <>
                        <strong>The reminder, {fmtSendTime(at)}</strong>
                        <span className="reg-meta">
                          To everyone registered who hasn&rsquo;t had it
                          {r.counts.reminderUnsent > 0 ? ` (${r.counts.reminderUnsent} now)` : " (no one yet)"}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>The note after, {fmtSendTime(at)}</strong>
                        <span className="reg-meta">
                          To everyone who had a place
                          {r.counts.registered > 0 ? ` (${r.counts.registered} now)` : " (no one yet)"}
                        </span>
                      </>
                    )}
                  </div>
                  <Link className="app-act" href={programHref(r.program.slug)}>Open the program</Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="reg-sectitle">Programs with registration on</h2>
        {taking.length === 0 ? (
          <p className="reg-quiet">No program has registration on.</p>
        ) : (
          <ul className="reg-list">
            {taking.map((r) => (
              <li key={r.program.slug}>
                <Link className="reg-prog" href={programHref(r.program.slug)}>
                  <span>
                    <span className="reg-prog__name">{r.program.name}</span>
                    <span className="reg-prog__meta">
                      {[r.when, registrationState(r.program, now), placesLine(r.program, r.counts)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="reg-prog__go" aria-hidden="true">Open &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <details className="reg-fold">
            <summary>Other programs with registrations ({others.length})</summary>
            <ul className="reg-list">
              {others.map((r) => (
                <li key={r.program.slug}>
                  <Link className="reg-prog" href={programHref(r.program.slug)}>
                    <span>
                      <span className="reg-prog__name">{r.program.name}</span>
                      <span className="reg-prog__meta">
                        {[
                          r.when,
                          r.archived ? "Archived" : isOver(r.program) ? "Over" : registrationState(r.program, now),
                          placesLine(r.program, r.counts),
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="reg-prog__go" aria-hidden="true">Open &rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
