import "server-only";
import { db } from "@/lib/db";
import type { SaveActor, SaveReply } from "@/lib/programSave";
import { canAccessHubScheduler, canManageHubCoverage, canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { buildHubMonthSessions, type ScheduleSessionRow } from "@/lib/scheduleSessions";
import { ctDateStr } from "@/lib/scheduleUtils";
import { ctDayBounds, fmtSessionDay } from "@/lib/timezone";
import { teamCannotStaff } from "@/lib/programHub";
import { COVERAGE_LOOKAHEAD_DAYS } from "@/lib/sessionWindowConstants";
import { recordContentChange, RECORDED_ONLY, type ChangedPart, type ContentKind } from "@/lib/contentChanges";
import { findProgram } from "@/lib/guideData";
import { confirmOrAsk } from "@/lib/guideRegistration";
import {
  askForCover,
  cancelCoverRequest,
  changeAssignment,
  coverRequest,
  deleteAssignment,
  placeOnSession,
  takeOverSession,
} from "@/lib/scheduleActions";
import { replyToConversation, startConversation } from "@/lib/teamActions";

/**
 * The Scheduler and team Conversations through the RIM Guide (2026-10-28,
 * phase 3): each person's own sessions and requests, a team lead's coverage
 * of their own team, and posting in a team's Conversations, each through the
 * site's own step (lib/scheduleActions.ts, lib/teamActions.ts), which checks
 * the same permissions as the buttons. Rotations, resets and team membership
 * stay on the site (Jesse).
 *
 * Ask first, as in lib/guideRegistration.ts: anything that would email
 * someone other than the person asking (a lead's change to someone, the team
 * told a session is open, a cover request, a reply's subscribers) does
 * nothing until the slip comes back. An email only to the person asking
 * (their own confirmation) is said in the answer instead (Jesse, 2026-10-28).
 */

type Actor = SaveActor & { name: string; email?: string | null };

const said = (r: SaveReply, fallback: string) => (typeof r.body.error === "string" ? r.body.error : fallback);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function keep(actor: Actor, kind: ContentKind, hub: { slug: string; name: string }, href: string, parts: ChangedPart[]): Promise<string> {
  try {
    // Everyday team work: in the list, not Jesse's daily email (Jesse, 2026-10-28).
    await recordContentChange({ userId: actor.id, userName: actor.name, kind, itemKey: hub.slug, itemLabel: hub.name, itemHref: href, changes: parts, inDaily: false });
    return RECORDED_ONLY;
  } catch (e) {
    console.error("[guideSchedule] recording a change failed", e);
    return " Its Content changes record didn't save.";
  }
}

/** A team by its address or exact name. */
async function theTeam(raw: string) {
  const q = raw.trim();
  if (!q) return "Which team? my_teams lists them.";
  const hub =
    (await db.hub.findUnique({ where: { slug: q.toLowerCase() }, select: { id: true, slug: true, name: true, allowsMultipleAssignments: true } })) ??
    (await db.hub.findFirst({ where: { name: { equals: q, mode: "insensitive" } }, select: { id: true, slug: true, name: true, allowsMultipleAssignments: true } }));
  return hub ?? `There's no team "${q}". my_teams lists the teams by the name to use.`;
}

/** One session on a team's schedule, as the Scheduler shows it. */
async function theSession(actor: Actor, team: string, program: string, date: string) {
  const hub = await theTeam(team);
  if (typeof hub === "string") return hub;
  if (!(await canAccessHubScheduler(actor.id, [...actor.roles], hub.slug))) return `You can't open the ${hub.name}'s schedule on the site, so the guide can't either.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Which day? Give the date as YYYY-MM-DD.";
  const found = await findProgram(program);
  if (typeof found === "string") return found;
  // The whole name or address, never a fragment: some of these act without asking.
  const named = await db.program.findUnique({ where: { slug: found.slug }, select: { name: true } });
  if (named && program.trim().toLowerCase() !== found.slug && program.trim().toLowerCase() !== named.name.toLowerCase()) {
    return `Did they mean ${named.name}? Ask again with the program's full name.`;
  }
  const [y, m] = date.split("-").map(Number);
  const { sessions } = await buildHubMonthSessions(hub.slug, y, m - 1);
  const row = sessions.find((s) => s.programSlug === found.slug && s.sessionDate && ctDateStr(s.sessionDate) === date);
  if (!row) return `That program isn't on the ${hub.name}'s schedule on ${date}. team_schedule shows what is.`;
  return { hub, row, when: `${row.programName} on ${fmtSessionDay(row.sessionDate ? new Date(row.sessionDate) : null)}` };
}

/** A member of the team, by whole name or email (never a partial match). */
async function teamMember(hubId: string, raw: string) {
  const q = raw.trim().toLowerCase();
  const members = await db.hubMember.findMany({
    where: { hubId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { userId: true, user: { select: { firstName: true, lastName: true, preferredName: true, email: true } } },
  });
  const name = (u: { firstName: string | null; lastName: string | null; preferredName: string | null }) => `${u.preferredName || u.firstName || ""} ${u.lastName ?? ""}`.trim();
  const words = q.split(/\s+/).filter(Boolean);
  const hits = members.filter(({ user: u }) =>
    u.email?.toLowerCase() === q ||
    (words.length > 0 && words.every((w) => [u.firstName, u.lastName, u.preferredName].some((n) => (n ?? "").toLowerCase() === w))),
  );
  if (hits.length === 1) return { id: hits[0].userId, name: name(hits[0].user) };
  if (hits.length > 1) return `More than one person on the team matches "${raw}": ${hits.map((h) => name(h.user)).join(", ")}. Give the full name.`;
  return `No one on the team is called exactly "${raw}". team_members lists them.`;
}

/** The team told a session is open: when the change leaves it with nobody on this team, within two weeks. */
async function gapWords(hubSlug: string, row: ScheduleSessionRow, leaving: string | null, actorId: string): Promise<string[]> {
  if (!row.sessionDate) return [];
  const at = new Date(row.sessionDate).getTime();
  const now = Date.now();
  if (at <= now || at - now > COVERAGE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000) return [];
  // As lib/coverageNotices.ts findGaps decides, with the person leaving gone:
  // a team that still staffs it, nobody else on that team that day, not
  // announced in the last day (review, 2026-10-28).
  if (await teamCannotStaff(hubSlug, row.programSlug)) return [];
  const day = ctDayBounds(new Date(row.sessionDate));
  const others = await db.hostAssignment.count({
    where: { hubSlug, programSlug: row.programSlug, sessionDate: { gte: day.start, lte: day.end }, userId: { not: null, ...(leaving ? { notIn: [leaving] } : {}) } },
  });
  if (others > 0) return [];
  const announced = await db.coverageNotice.findFirst({
    where: { kind: "gap-opened", hubSlug, programSlug: row.programSlug, sessionDay: ctDateStr(row.sessionDate), createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (announced) return [];
  const recipients = (await getHubNotificationRecipients(hubSlug, { canCover: true, withMuted: true })).filter((u) => u.id !== actorId && u.id !== leaving && !u.muted && !!u.email);
  return recipients.length ? [`That leaves it with nobody on the team, so the ${plural(recipients.length, "member")} who can take sessions will be emailed that it needs someone.`] : [];
}

const asHtml = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");

// ─── Sessions ───────────────────────────────────────────────────────────────

/** Take an open session, or sign up on an open sign-up team. Emails only the person asking. */
export async function sessionTake(actor: Actor, input: { team: string; program: string; date: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  let r: SaveReply;
  if (hub.allowsMultipleAssignments) {
    if (row.claimants.some((c) => c.userId === actor.id)) return `You're already signed up for ${when}.`;
    r = await placeOnSession(actor, { programSlug: row.programSlug, sessionDate: row.sessionDate, action: "claim", hubSlug: hub.slug });
  } else {
    if (row.status !== "unclaimed") return row.hostUserId === actor.id ? `${when} is already yours.` : `${when} already has someone${row.status === "sub_needed" ? " who asked for cover (cover_take covers it)" : ""}.`;
    r = row.id.startsWith("unassigned::")
      ? await placeOnSession(actor, { programSlug: row.programSlug, sessionDate: row.sessionDate, action: "claim", hubSlug: hub.slug })
      : await changeAssignment(actor, row.id, { action: "claim" });
  }
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: "open", after: `${actor.name} took it` }]);
  return `You have ${when} with the ${hub.name}. A confirmation is on its way to you.${kept}`;
}

/** Give up your session (or cancel your sign-up), or a lead takes someone off. */
export async function sessionGiveUp(actor: Actor, input: { team: string; program: string; date: string; person?: string; confirm?: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  let who = { id: actor.id, name: actor.name };
  if (input.person?.trim()) {
    const m = await teamMember(hub.id, input.person);
    if (typeof m === "string") return m;
    who = m;
  }
  const self = who.id === actor.id;
  if (!self && !(await canManageHubCoverage(actor.id, [...actor.roles], hub.slug))) return "Only the team's lead can take someone else off a session.";
  const mine = hub.allowsMultipleAssignments ? row.claimants.find((c) => c.userId === who.id) : row.hostUserId === who.id ? { assignmentId: row.id } : null;
  if (!mine) return `${self ? "You're" : `${who.name} is`} not on ${when}.`;
  const emails = [
    ...(self ? [] : [`This takes ${who.name} off ${when}, and emails them to say so.`]),
    ...(await gapWords(hub.slug, row, who.id, actor.id)),
  ];
  const ask = emails.length ? await confirmOrAsk(actor.id, "session_give_up", input, emails, input.confirm) : null;
  if (ask) return ask;
  const r = hub.allowsMultipleAssignments ? await deleteAssignment(actor, mine.assignmentId) : await changeAssignment(actor, mine.assignmentId, { action: "unclaim" });
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const told = r.body.teamTold ? " The team was told it needs someone." : "";
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: who.name, after: "off it" }]);
  return `${self ? "You're" : `${who.name} is`} off ${when}.${told}${kept}`;
}

/** A lead puts someone on a session. */
export async function sessionAssign(actor: Actor, input: { team: string; program: string; date: string; person: string; confirm?: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  if (!(await canManageHubCoverage(actor.id, [...actor.roles], hub.slug))) return "Only the team's lead can put someone on a session.";
  if (hub.allowsMultipleAssignments) return "This team uses open sign-up, so people sign themselves up.";
  if (row.status !== "unclaimed") return `${when} already has someone. Take them off first, or take it over yourself.`;
  const m = await teamMember(hub.id, input.person);
  if (typeof m === "string") return m;
  const emails = m.id === actor.id ? [] : [`This puts ${m.name} on ${when} and emails them a confirmation.`];
  const ask = emails.length ? await confirmOrAsk(actor.id, "session_assign", input, emails, input.confirm) : null;
  if (ask) return ask;
  // The Scheduler's own step fills the open row, or makes one for the session.
  const r = await placeOnSession(actor, { programSlug: row.programSlug, sessionDate: row.sessionDate, userId: m.id, hubSlug: hub.slug });
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: "open", after: m.name }]);
  return `${m.name} is on ${when}.${m.id === actor.id ? " A confirmation is on its way to you." : ""}${kept}`;
}

/** A lead takes a session over themselves. */
export async function sessionTakeOver(actor: Actor, input: { team: string; program: string; date: string; confirm?: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  if (row.id.startsWith("unassigned::") || row.id.startsWith("multi::")) return `${when} isn't on the schedule with anyone; take it with session_take.`;
  if (row.hostUserId === actor.id) return `${when} is already yours.`;
  const emails = row.hostUserId ? [`This takes ${when} over from ${row.hostName ?? "the person on it"}, who is emailed to say so; you get a confirmation.`] : [];
  const ask = emails.length ? await confirmOrAsk(actor.id, "session_take_over", input, emails, input.confirm) : null;
  if (ask) return ask;
  const r = await takeOverSession(actor, { currentAssignmentId: row.id });
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: row.hostName ?? "open", after: actor.name }]);
  return `You have ${when} now. A confirmation is on its way to you.${kept}`;
}

// ─── Cover requests ─────────────────────────────────────────────────────────

/** Ask the team to cover your session (or, for a lead, someone's). */
export async function coverAsk(actor: Actor, input: { team: string; program: string; date: string; note?: string; person?: string; confirm?: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  if (hub.allowsMultipleAssignments) return "This team uses open sign-up: cancel the sign-up instead of asking for cover.";
  if (row.status === "sub_needed") return `Cover is already asked for ${when}.`;
  if (!row.hostUserId) return `No one is on ${when}, so there's nothing to cover.`;
  if (row.hostUserId !== actor.id && !input.person) return `${when} is ${row.hostName ?? "someone else"}'s. A lead can ask on their behalf by naming them.`;
  if (input.person?.trim()) {
    const named = await teamMember(hub.id, input.person);
    if (typeof named === "string") return named;
    if (named.id !== row.hostUserId) return `${named.name} isn't on ${when}; ${row.hostName ?? "no one"} is.`;
  }
  const recipients = (await getHubNotificationRecipients(hub.slug, { canCover: true, withMuted: true }))
    .filter((u) => u.id !== row.hostUserId && u.id !== actor.id && !u.muted);
  const emails = [`This asks the ${hub.name} to cover ${row.hostUserId === actor.id ? "your" : `${row.hostName}'s`} ${when}, emailing the ${plural(recipients.length, "member")} who can take it${input.note?.trim() ? `, with the note: "${input.note.trim()}"` : ""}.`];
  const ask = await confirmOrAsk(actor.id, "cover_ask", input, emails, input.confirm);
  if (ask) return ask;
  const r = await askForCover(actor, { assignmentId: row.id, message: input.note?.trim() ? asHtml(input.note) : null });
  if (r.status !== 200) return `Nothing was asked. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: row.hostName, after: "cover asked for" }]);
  return `The team is being asked to cover ${when}.${kept}`;
}

/** Cover someone's request. */
export async function coverTake(actor: Actor, input: { team: string; program: string; date: string; note?: string; confirm?: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  if (row.status !== "sub_needed" || !row.subRequestId) return `No one has asked for cover on ${when}.`;
  if (row.hostUserId === actor.id) return "That's your own request; clear it with cover_cancel instead.";
  const emails = [`This covers ${when} for ${row.hostName ?? "the person who asked"}, who is emailed that it's covered${input.note?.trim() ? `, with your note: "${input.note.trim()}"` : ""}; you get a confirmation.`];
  const ask = await confirmOrAsk(actor.id, "cover_take", input, emails, input.confirm);
  if (ask) return ask;
  const r = await coverRequest(actor, row.subRequestId, { message: input.note?.trim() ? asHtml(input.note) : undefined });
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: row.hostName, after: `${actor.name} covers it` }]);
  return `You're covering ${when}.${kept}`;
}

/** Clear a cover request (your own, or a lead's team). Emails no one. */
export async function coverCancel(actor: Actor, input: { team: string; program: string; date: string }): Promise<string> {
  const s = await theSession(actor, input.team, input.program, input.date);
  if (typeof s === "string") return s;
  const { hub, row, when } = s;
  if (row.status !== "sub_needed" || !row.subRequestId) return `There's no open cover request on ${when}.`;
  const r = await cancelCoverRequest(actor, row.subRequestId);
  if (r.status !== 200) return `Nothing changed. ${said(r, "It couldn't be saved.")}`;
  const kept = await keep(actor, "schedule", hub, `/tools/schedule?hub=${hub.slug}`, [{ label: when, before: "cover asked for", after: "request cleared" }]);
  return `The cover request for ${when} is cleared; ${row.hostName ?? "the person"} is still on it.${kept}`;
}

// ─── Conversations ──────────────────────────────────────────────────────────

/** The members a post emails: active, signed in, emails on, not the person posting. */
async function emailedMembers(hubId: string, userIds: string[], actorId: string) {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (!ids.length) return 0;
  return db.hubMember.count({ where: { hubId, userId: { in: ids }, status: "ACTIVE", communicationsEnabled: true, user: { archivedAt: null } } });
}

async function teamForPosting(actor: Actor, team: string) {
  const hub = await theTeam(team);
  if (typeof hub === "string") return hub;
  const { hub: full, member } = await getHubMembership(hub.slug, actor.id);
  if (!full?.conversationsEnabled || !canAccessHub(member, [...actor.roles])) return `You can't post in the ${hub.name}'s Conversations on the site, so the guide can't either.`;
  return hub;
}

/** Start a conversation in a team. Emails its leads and anyone named. */
export async function conversationStart(actor: Actor, input: { team: string; title: string; message: string; notify?: string[]; confirm?: string }): Promise<string> {
  const hub = await teamForPosting(actor, input.team);
  if (typeof hub === "string") return hub;
  if (!input.title.trim() || !input.message.trim()) return "A conversation needs a title and a message.";
  const picked: { id: string; name: string }[] = [];
  for (const n of input.notify ?? []) {
    const m = await teamMember(hub.id, n);
    if (typeof m === "string") return m;
    picked.push(m);
  }
  const leads = (await db.hubMember.findMany({ where: { hubId: hub.id, isCoordinator: true, status: "ACTIVE" }, select: { userId: true } })).filter((l) => l.userId !== actor.id);
  const n = await emailedMembers(hub.id, [...leads.map((l) => l.userId), ...picked.map((p) => p.id)], actor.id);
  const who = [leads.length ? "the team's leads" : "", picked.length ? picked.map((p) => p.name).join(", ") : ""].filter(Boolean).join(" and ");
  const emails = n ? [`This posts "${input.title.trim()}" in the ${hub.name}'s Conversations and emails ${plural(n, "person", "people")} (${who}, as their email choices allow).`] : [];
  const ask = emails.length ? await confirmOrAsk(actor.id, "conversation_start", input, emails, input.confirm) : null;
  if (ask) return ask;
  const r = await startConversation({ ...actor }, hub.slug, { title: input.title, body: asHtml(input.message), notifyUserIds: picked.map((p) => p.id) });
  if (r.status !== 201) return `Nothing was posted. ${said(r, "It couldn't be posted.")}`;
  const kept = await keep(actor, "conversation", hub, `/account/hub/${hub.slug}/conversations/${r.body.id as string}`, [{ label: input.title.trim(), before: null, after: input.message.trim() }]);
  return `Posted "${input.title.trim()}" in the ${hub.name}'s Conversations.${kept}`;
}

/** Reply to a conversation. Emails those following it. */
export async function conversationReply(actor: Actor, input: { team: string; conversation: string; message: string; notify?: string[]; confirm?: string }): Promise<string> {
  const hub = await teamForPosting(actor, input.team);
  if (typeof hub === "string") return hub;
  if (!input.message.trim()) return "Write the reply first.";
  const q = input.conversation.trim();
  const threads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, deletedAt: null, archivedAt: null, title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true },
    take: 6,
  });
  const exact = threads.filter((t) => t.title.toLowerCase() === q.toLowerCase());
  const thread = exact.length === 1 ? exact[0] : threads.length === 1 ? threads[0] : null;
  if (!thread) return threads.length ? `More than one conversation matches "${q}": ${threads.map((t) => `"${t.title}"`).join(", ")}. Give the full title.` : `No open conversation in the ${hub.name} has "${q}" in its title.`;
  const picked: { id: string; name: string }[] = [];
  for (const n of input.notify ?? []) {
    const m = await teamMember(hub.id, n);
    if (typeof m === "string") return m;
    picked.push(m);
  }
  const subs = await db.hubThreadSubscription.findMany({ where: { threadId: thread.id }, select: { userId: true } });
  const n = await emailedMembers(hub.id, [...subs.map((x) => x.userId), ...picked.map((p) => p.id)], actor.id);
  const emails = n ? [`This replies in "${thread.title}" and emails ${plural(n, "person", "people")}: those following it${picked.length ? `, and ${picked.map((p) => p.name).join(", ")}, added now` : ""}, as their email choices allow.`] : [];
  const ask = emails.length ? await confirmOrAsk(actor.id, "conversation_reply", input, emails, input.confirm) : null;
  if (ask) return ask;
  const r = await replyToConversation({ ...actor }, hub.slug, thread.id, { body: asHtml(input.message), notifyUserIds: picked.map((p) => p.id) });
  if (r.status !== 201) return `Nothing was posted. ${said(r, "It couldn't be posted.")}`;
  const kept = await keep(actor, "conversation", hub, `/account/hub/${hub.slug}/conversations/${thread.id}`, [{ label: `A reply in ${thread.title}`, before: null, after: input.message.trim() }]);
  return `Replied in "${thread.title}".${kept}`;
}
