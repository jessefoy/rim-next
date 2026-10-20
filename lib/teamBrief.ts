/**
 * A team lead's brief (2026-10-20). Jesse, on the coordinators' emails: "If
 * a manager was informed about something, they would say, 'Present this in
 * a way that is easy for me to look at and make decisions on.'" A lead got
 * three kinds of bare list (the Monday look-ahead, a daily "still needs",
 * and the gaps as they opened). The brief replaces the first two for leads:
 *
 *   - Needs your decision: each open session, why it's open, and who on the
 *     team can take it (active, able to take sessions, not already serving
 *     that day), with a link to that session.
 *   - Since last time: what changed on the schedule (the team's record),
 *     leaving included: leads see who stepped back (Jesse, 2026-10-19).
 *   - All set: how many of the sessions ahead have someone.
 *
 * Mondays: the next two weeks. Other days: only sessions two days out that
 * are still open, once each. Members keep their own emails. Template:
 * "team-lead-brief" (wording provisional until Jesse's read-aloud).
 */

import { db } from "@/lib/db";
import { ctDateStr } from "@/lib/scheduleUtils";
import { fmtSessionWhen } from "@/lib/timezone";
import type { ScheduleSessionRow } from "@/lib/scheduleSessions";
import { listHubActivity } from "@/lib/hubActivity";
import { scheduleSessionHref } from "@/lib/hubApps";
import { coverageWords, emailButtonHtml, emailLink, sendTemplatedEmail } from "@/lib/email";

/** Names as people typed them, inert in markdown. */
function md(text: string): string {
  return text.replace(/[\\`*_[\]<>#|]/g, (c) => `\\${c}`);
}

function nameOf(u: { firstName: string | null; lastName: string | null; preferredName: string | null } | null | undefined): string {
  if (!u) return "Someone";
  return [u.preferredName || u.firstName, u.lastName].filter(Boolean).join(" ") || "Someone";
}

function daysAgo(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** "Maria Sprecher, Nancy Lakam and 3 others". */
function nameList(names: string[], max = 4): string {
  if (names.length === 0) return "";
  if (names.length <= max) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(", ")} and ${names.length - max} others`;
}

export interface TeamBrief {
  /** Markdown for {{brief}}. */
  body: string;
  decisions: number;
  changes: number;
}

/**
 * Build one team's brief. `rows`: the team's sessions in the window (the
 * Scheduler's row builder); `decide`: those to put under Needs your decision.
 * `since`: what changed after this moment goes under Since last time (null:
 * leave it out). `viewerId`: a lead, whose view of the record is used.
 */
export async function buildTeamBrief(opts: {
  hubSlug: string;
  hubId: string;
  rows: ScheduleSessionRow[];
  decide: ScheduleSessionRow[];
  since: Date | null;
  sinceLabel: string;
  viewerId: string;
  windowLabel: string;
  now?: Date;
}): Promise<TeamBrief> {
  const now = opts.now ?? new Date();
  const words = await coverageWords(opts.hubSlug);
  const parts: string[] = [];

  // Who could take each open session: active, allowed to take sessions, not
  // already serving this team that Central day, and not the person asking.
  if (opts.decide.length) {
    const members = await db.hubMember.findMany({
      // Signed in at least once: a staged account can't be asked yet.
      where: { hubId: opts.hubId, status: "ACTIVE", hostingCapability: true, user: { archivedAt: null, emailVerified: { not: null } } },
      select: { userId: true, user: { select: { firstName: true, lastName: true, preferredName: true } } },
    });
    const dates = opts.decide.flatMap((r) => (r.sessionDate ? [new Date(r.sessionDate).getTime()] : []));
    const serving = dates.length
      ? await db.hostAssignment.findMany({
          where: {
            hubSlug: opts.hubSlug,
            userId: { not: null },
            sessionDate: { gte: new Date(Math.min(...dates) - 86_400_000), lte: new Date(Math.max(...dates) + 86_400_000) },
          },
          select: { userId: true, sessionDate: true },
        })
      : [];
    const busy = new Set(serving.flatMap((a) => (a.userId && a.sessionDate ? [`${a.userId}~${ctDateStr(a.sessionDate.toISOString())}`] : [])));
    const asked = await db.subRequest.findMany({
      where: { id: { in: opts.decide.flatMap((r) => (r.subRequestId ? [r.subRequestId] : [])) } },
      select: { id: true, createdAt: true, requestedById: true },
    });
    const askedAt = new Map(asked.map((a) => [a.id, a.createdAt]));
    // Who asked: a coordinator may ask on someone's behalf (requestedById
    // is the person whose session it is; older rows leave it empty).
    const askerIds = [...new Set(asked.flatMap((a) => (a.requestedById ? [a.requestedById] : [])))];
    const askers = askerIds.length
      ? await db.user.findMany({ where: { id: { in: askerIds } }, select: { id: true, firstName: true, lastName: true, preferredName: true } })
      : [];
    const askerOf = new Map(asked.map((a) => [a.id, a.requestedById ? nameOf(askers.find((u) => u.id === a.requestedById)) : null]));

    const lines: string[] = [`**Needs your decision**`];
    for (const r of opts.decide) {
      const day = r.sessionDate ? ctDateStr(r.sessionDate) : null;
      const when = fmtSessionWhen(r.sessionDate ? new Date(r.sessionDate) : null) ?? "date to be confirmed";
      const why = r.status === "sub_needed"
        ? `${md((r.subRequestId && askerOf.get(r.subRequestId)) || r.hostName || "Someone")} asked the team to cover${r.subRequestId && askedAt.get(r.subRequestId) ? ` ${daysAgo(askedAt.get(r.subRequestId)!, now)}` : ""}. No one has taken it yet.`
        : `No ${words.coverageRole} yet.`;
      const able = members
        .filter((m) => !(day && busy.has(`${m.userId}~${day}`)) && m.userId !== r.hostUserId)
        .map((m) => md(nameOf(m.user)))
        .sort((a, b) => a.localeCompare(b));
      const who = able.length ? `Can take it: ${nameList(able)}.` : `No one else on the team is free to take it that day.`;
      const link = emailLink(scheduleSessionHref(opts.hubSlug, r.programSlug, r.sessionDate ? new Date(r.sessionDate) : null));
      lines.push("", `**${md(r.programName)} · ${when}**`, why, who, `[Open this session](${link})`);
    }
    parts.push(lines.join("\n"));
  }

  // What changed: the team's record, as Updates says it (a lead's view, so
  // leaving is included). Cover requests and gaps are left out: the open
  // ones are above, and the rest are history.
  let changes = 0;
  if (opts.since) {
    const page = await listHubActivity({
      hubId: opts.hubId,
      hubSlug: opts.hubSlug,
      viewer: { userId: opts.viewerId, roles: [], isLead: true, readPoint: null },
      folder: "app:schedule",
      limit: 100,
      passes: 1,
    });
    const items = page.items.filter(
      (i) => new Date(i.ts) > opts.since! && (i.id.startsWith("event-") || i.id.startsWith("schedule-sub-claim-")),
    );
    changes = items.length;
    if (items.length) {
      const shown = items.slice(0, 12).map((i) => {
        const sentence = [i.authorName && `**${md(i.authorName)}**`, i.verb, i.subject && md(i.subject)].filter(Boolean).join(" ");
        return `- ${sentence}${i.note ? ` (${md(i.note)})` : ""}`;
      });
      const more = items.length > 12
        ? `\n- And ${items.length - 12} more in [the team's Updates](${emailLink(`/account/hub/${opts.hubSlug}/activity?type=app:schedule`)})`
        : "";
      parts.push(`**${opts.sinceLabel}**\n\n${shown.join("\n")}${more}`);
    }
  }

  const open = opts.rows.filter((r) => r.status === "unclaimed" || r.status === "sub_needed").length;
  const total = opts.rows.length;
  if (total) {
    parts.push(`**All set**\n\n${total - open} of ${total} sessions ${opts.windowLabel} have ${words.needsRole}.`);
  }

  return { body: parts.join("\n\n"), decisions: opts.decide.length, changes };
}

/** Send a lead their brief. `headline` is the subject. */
export async function sendTeamLeadBrief(opts: {
  to: string;
  firstName: string | null;
  hubSlug: string;
  headline: string;
  intro: string;
  brief: string;
}): Promise<void> {
  const words = await coverageWords(opts.hubSlug);
  const scheduleUrl = emailLink(scheduleSessionHref(opts.hubSlug, null, null));
  await sendTemplatedEmail("team-lead-brief", opts.to, {
    ...words,
    firstName: opts.firstName ?? "there",
    headline: opts.headline,
    intro: opts.intro,
    brief: opts.brief,
    scheduleUrl,
    scheduleButton: emailButtonHtml("Open the schedule", scheduleUrl),
  });
}
