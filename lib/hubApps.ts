import { db } from "@/lib/db";
import { ctMonthKey, ctStartOfToday, fmtSessionWhen } from "@/lib/timezone";
import { countSessionsNeedingSomeone, LOOKAHEAD_DAYS, sessionsNeedingSomeone } from "@/lib/coverageNotices";
import { getHubCoverageConfig, getHubCoverageCopy } from "@/lib/programHub";
import { ctDateStr } from "@/lib/scheduleUtils";
import { canSelfClaim } from "@/lib/hubMemberAuth";
import { HUB_EVENT_KINDS, LEADS_ONLY_EVENT_KINDS, type HubEventKind } from "@/lib/hubEvents";
import {
  getToolBySlug,
  TOOL_REGISTRY,
  type ToolDefinition,
  type ToolSlug,
} from "@/lib/toolRegistry";

export interface HubAppLinkInput {
  toolSlug: string | null;
  label: string;
  href: string;
  isEnabled: boolean;
  isPrimary?: boolean;
}

export interface HubHomeApp {
  key: string;
  toolSlug: ToolSlug | null;
  label: string;
  path: string;
  description: string;
  count: number | null;
  countLabel: string | null;
  quietText: string;
  isRegistered: boolean;
  role: "primary" | "supporting" | "link";
  homeMode: "summary" | "none";
}

export interface HubAppAttentionItem {
  id: string;
  sourceKey: `app:${ToolSlug}`;
  sourceLabel: string;
  label: string;
  href: string;
  count: number;
}

/** A session someone can take, offered right on the Updates item. */
export interface HubTakeSessionAction {
  kind: "take" | "cover" | "sign-up";
  hubSlug: string;
  programSlug: string;
  programName: string;
  sessionDate: string;
  subRequestId: string | null;
  /** The person being covered for ("cover"). */
  forName: string | null;
  /** The team's action words: "host this", "greet". */
  coverageAction: string;
  /** The team's verb: "hosting", "greeting". */
  coverageVerb: string;
}

export interface HubAppUpdateItem {
  id: string;
  sourceKey: `app:${ToolSlug}`;
  sourceLabel: string;
  kind: string;
  /** Who did it: the viewer's own doings are never unread. */
  actorId?: string | null;
  authorId: string | null;
  authorName: string;
  verb: string;
  subject: string | null;
  href: string;
  ts: string;
  isForUser: boolean;
  /** Where it stands now: "Open", "Covered by Nancy", "Withdrawn", "Passed". */
  state?: { label: string; tone: "open" | "done" | "quiet" } | null;
  /** A quiet second line: "Added by Maria". */
  note?: string | null;
  /** Shown only to the team's leads (and the person it is about). */
  leadsOnly?: boolean;
  action?: HubTakeSessionAction | null;
}

export interface HubAppUpdateQuery {
  hubId: string;
  hubSlug: string;
  userId: string;
  cursorDate: Date | null;
  /** Unread only: items after this moment (the person's read point). */
  since: Date | null;
  /** Only what is about the viewer. */
  forYou: boolean;
  isLead: boolean;
  limit: number;
}

/** A page of an app's history, and how far back it is complete: every one of
 *  its items newer than `boundary` was fetched (null = everything was). */
export interface HubAppUpdatePage {
  items: HubAppUpdateItem[];
  boundary: Date | null;
}

export interface HubAppNeedsQuery {
  hubId: string;
  hubSlug: string;
  userId: string;
  roles: string[];
  isLead: boolean;
}

type HomeContribution = Pick<HubHomeApp, "count" | "countLabel" | "quietText">;

interface HubAppProvider {
  home(hubSlug: string): Promise<HomeContribution>;
  updates?(query: HubAppUpdateQuery): Promise<HubAppUpdatePage>;
  /** What the viewer could do something about now (Updates' "Needs you"). */
  needs?(query: HubAppNeedsQuery): Promise<HubAppUpdateItem[]>;
  attention?(hubId: string, hubSlug: string, userId: string): Promise<HubAppAttentionItem[]>;
}

function plural(count: number, singular: string, multiple: string) {
  return count === 1 ? singular : multiple;
}

function personName(u: {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
} | null | undefined) {
  if (!u) return "Someone";
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

// The cursor is inclusive: a page ends just before its boundary moment, so
// rows sharing that moment come on the next page (createMany gives a batch
// one timestamp).
function createdAtWindow(query: HubAppUpdateQuery) {
  const gt = query.since ?? undefined;
  const lte = query.cursorDate ?? undefined;
  return gt || lte ? { ...(gt ? { gt } : {}), ...(lte ? { lte } : {}) } : undefined;
}

/** The newest moment down to which every source is complete. */
export function completeDownTo(sources: { createdAt: Date }[][], limit: number): Date | null {
  let boundary: Date | null = null;
  for (const rows of sources) {
    if (rows.length < limit) continue;
    const oldest = rows[rows.length - 1].createdAt;
    if (!boundary || oldest > boundary) boundary = oldest;
  }
  return boundary;
}

/** The role after "need": "a greeter", "a host", but "AV". */
function needsRoleOf(noun: string): string {
  if (/^[A-Z0-9/&]+$/.test(noun)) return noun;
  const role = noun.toLowerCase();
  return `${/^[aeiou]/.test(role) ? "an" : "a"} ${role}`;
}

// The line in the highlighted tool card on team Home: how many of the team's
// sessions in the next two weeks need someone, counted from the Scheduler's
// own row builder (2026-10-16, closing backlog 2026-10-13-005: open sessions
// often have no HostAssignment row, so counting rows would have told a team
// it was covered when it wasn't). A session with an open cover request counts.
async function scheduleHome(hubSlug: string): Promise<HomeContribution> {
  const [{ open: count, total }, copy] = await Promise.all([countSessionsNeedingSomeone(hubSlug), getHubCoverageCopy(hubSlug)]);
  const needs = needsRoleOf(copy.noun);
  const weeks = LOOKAHEAD_DAYS === 14 ? "the next two weeks" : `the next ${LOOKAHEAD_DAYS} days`;
  return {
    count: count || null,
    countLabel: count
      ? plural(count, `session in ${weeks} needs ${needs}`, `sessions in ${weeks} need ${needs}`)
      : null,
    // With nothing on the schedule, "every session is covered" would be
    // true of nothing (reviewer, 2026-10-16).
    quietText: total ? `Every session in ${weeks} has ${needs}.` : `No sessions on the schedule in ${weeks}.`,
  };
}

/** Archived programs leave the board and Home's line (buildHubMonthSessions);
 *  "For me" and the attention line follow them, or a cover request on an
 *  archived program stayed "open" with nowhere to act on it (2026-10-19
 *  audit). History (All, Recent) keeps them. */
async function archivedProgramSlugs(): Promise<string[]> {
  return (await db.program.findMany({ where: { archivedAt: { not: null } }, select: { slug: true } })).map((p) => p.slug);
}

export { scheduleSessionHref } from "@/lib/scheduleLinks";
import { scheduleSessionHref } from "@/lib/scheduleLinks";

/** "Good Evening · Fri, Oct 24 at 6:30 PM" */
function sessionTitle(programName: string, date: Date | null): string {
  return date ? `${programName} · ${fmtSessionWhen(date)}` : programName;
}

const DAY_NAMES: Record<string, string> = {
  MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday",
};
const ORDINALS: Record<string, string> = {
  FIRST: "first", SECOND: "second", THIRD: "third", FOURTH: "fourth", FIFTH: "fifth", LAST: "last",
};

/** "every Thursday", "every other Thursday", "the first Thursday of the month". */
function rotationPhrase(detail: unknown): string {
  const d = detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {};
  const day = typeof d.dayOfWeek === "string" ? DAY_NAMES[d.dayOfWeek] : null;
  const occ = typeof d.occurrence === "string" ? d.occurrence : null;
  if (!day) return "its rotation";
  if (occ === "ALL") return `every ${day}`;
  if (occ === "ALT_WEEK_A" || occ === "ALT_WEEK_B") return `every other ${day}`;
  if (occ && ORDINALS[occ]) return `the ${ORDINALS[occ]} ${day} of the month`;
  return `${day}s`;
}

function plainCount(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Why a person came off the schedule, in plain words. */
function releaseReason(detail: unknown): string | null {
  const reason = detail && typeof detail === "object" ? (detail as Record<string, unknown>).reason : null;
  switch (reason) {
    case "paused": return "Paused on the team";
    case "inactive": return "Marked inactive on the team";
    case "archived": return "Account archived";
    case "deleted": return "Account removed";
    default: return null;
  }
}

const SCHEDULE_EVENT_KINDS = HUB_EVENT_KINDS.filter((k) => k !== "member-left");

/**
 * The Scheduler's history in Updates (2026-10-19). Cover requests and the
 * claims on them come from their own rows, with where each stands now; a
 * session that needs someone from coverage_notices; everything else (taking,
 * being put on, leaving, rotations) from the team's record, lib/hubEvents.ts.
 * Who leaves is named only to the leads and the person (Jesse, 2026-10-19).
 */
async function scheduleUpdates(query: HubAppUpdateQuery): Promise<HubAppUpdatePage> {
  const createdAt = createdAtWindow(query);
  const at = createdAt ? { createdAt } : {};
  const { hubSlug, userId, forYou } = query;
  const now = new Date();

  const [requests, claims, gaps, events, copy] = await Promise.all([
    forYou
      ? Promise.resolve([])
      : db.subRequest.findMany({
          where: { assignment: { hubSlug }, ...at },
          select: {
            id: true, programSlug: true, sessionDate: true, createdAt: true, status: true, requestedById: true,
            assignment: { select: { userId: true } },
            claim: { select: { claimedById: true } },
          },
          orderBy: { createdAt: "desc" },
          take: query.limit,
        }),
    db.subClaim.findMany({
      where: {
        // "For you": someone took your request.
        request: { assignment: { hubSlug }, ...(forYou ? { requestedById: userId } : {}) },
        ...(forYou ? { claimedById: { not: userId } } : {}),
        ...at,
      },
      select: {
        id: true, claimedById: true, createdAt: true,
        request: { select: { programSlug: true, sessionDate: true, requestedById: true, assignment: { select: { userId: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    }),
    forYou
      ? Promise.resolve([])
      : db.coverageNotice.findMany({
          where: { kind: "gap-opened", hubSlug, ...at },
          select: { id: true, programSlug: true, sessionDate: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: query.limit,
        }),
    db.hubEvent.findMany({
      where: {
        hubSlug,
        kind: { in: [...SCHEDULE_EVENT_KINDS] },
        ...at,
        ...(forYou
          // About you, done by someone else (or the daily pass).
          ? { subjectUserId: userId, OR: [{ actorId: null }, { actorId: { not: userId } }] }
          : query.isLead
            ? {}
            : { OR: [{ kind: { notIn: [...LEADS_ONLY_EVENT_KINDS] } }, { subjectUserId: userId }] }),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    }),
    getHubCoverageCopy(hubSlug),
  ]);

  // Names, once.
  const personIds = new Set<string>();
  for (const r of requests) {
    if (r.requestedById) personIds.add(r.requestedById);
    else if (r.assignment.userId) personIds.add(r.assignment.userId);
    if (r.claim) personIds.add(r.claim.claimedById);
  }
  for (const c of claims) {
    personIds.add(c.claimedById);
    if (c.request.requestedById) personIds.add(c.request.requestedById);
  }
  for (const e of events) {
    if (e.actorId) personIds.add(e.actorId);
    if (e.subjectUserId) personIds.add(e.subjectUserId);
  }
  const programSlugs = new Set<string>([
    ...requests.map((r) => r.programSlug),
    ...claims.map((c) => c.request.programSlug),
    ...gaps.flatMap((g) => (g.programSlug ? [g.programSlug] : [])),
    ...events.flatMap((e) => (e.programSlug ? [e.programSlug] : [])),
  ]);
  const [people, programs] = await Promise.all([
    personIds.size
      ? db.user.findMany({ where: { id: { in: [...personIds] } }, select: { id: true, firstName: true, lastName: true, preferredName: true } })
      : Promise.resolve([]),
    programSlugs.size
      ? db.program.findMany({ where: { slug: { in: [...programSlugs] } }, select: { slug: true, name: true } })
      : Promise.resolve([]),
  ]);
  const personById = new Map(people.map((p) => [p.id, p]));
  const nameOf = (id: string | null | undefined) => personName(id ? personById.get(id) : null);
  const programName = (slug: string | null) => (slug ? programs.find((p) => p.slug === slug)?.name ?? slug : "A session");

  // Is each future gap still open? One query for all of them.
  const futureGaps = gaps.filter((g) => g.programSlug && g.sessionDate && g.sessionDate > now);
  const filled = new Set<string>();
  if (futureGaps.length) {
    const dates = futureGaps.map((g) => g.sessionDate!.getTime());
    const rows = await db.hostAssignment.findMany({
      where: {
        hubSlug,
        userId: { not: null },
        programSlug: { in: [...new Set(futureGaps.map((g) => g.programSlug!))] },
        sessionDate: { gte: new Date(Math.min(...dates) - 86_400_000), lte: new Date(Math.max(...dates) + 86_400_000) },
      },
      select: { programSlug: true, sessionDate: true },
    });
    for (const r of rows) if (r.sessionDate) filled.add(`${r.programSlug}~${ctDateStr(r.sessionDate.toISOString())}`);
  }

  const needs = needsRoleOf(copy.noun);
  const base = { sourceKey: "app:schedule" as const, sourceLabel: "Schedule" };
  const items: HubAppUpdateItem[] = [];

  for (const gap of gaps) {
    const passed = !gap.sessionDate || gap.sessionDate <= now;
    const isFilled = !passed && gap.programSlug && gap.sessionDate
      ? filled.has(`${gap.programSlug}~${ctDateStr(gap.sessionDate.toISOString())}`)
      : false;
    items.push({
      ...base,
      id: `schedule-gap-${gap.id}`,
      kind: "coverage-gap",
      authorId: null,
      authorName: sessionTitle(programName(gap.programSlug), gap.sessionDate),
      verb: `needed ${needs}`,
      subject: null,
      href: scheduleSessionHref(hubSlug, gap.programSlug, gap.sessionDate),
      ts: gap.createdAt.toISOString(),
      isForUser: false,
      state: passed
        ? { label: "Passed", tone: "quiet" }
        : isFilled
          ? { label: "Filled", tone: "done" }
          : { label: "Still open", tone: "open" },
    });
  }

  for (const r of requests) {
    // Older requests (before 2026-10-15) didn't record who asked; once covered,
    // the assignment's person is the one covering, so the asker is unknown.
    const asker = r.requestedById ?? (r.status === "CLAIMED" ? null : r.assignment.userId);
    const passed = !!r.sessionDate && r.sessionDate <= now;
    items.push({
      ...base,
      id: `schedule-sub-${r.id}`,
      kind: "coverage-requested",
      actorId: asker,
      authorId: asker,
      authorName: asker ? nameOf(asker) : "",
      verb: asker ? "asked for someone to cover" : "Cover was asked for",
      subject: sessionTitle(programName(r.programSlug), r.sessionDate),
      href: scheduleSessionHref(hubSlug, r.programSlug, r.sessionDate),
      ts: r.createdAt.toISOString(),
      isForUser: false,
      state:
        r.status === "CLAIMED" && r.claim
          ? { label: `Covered by ${nameOf(r.claim.claimedById)}`, tone: "done" }
          : r.status === "CANCELLED"
            // "Closed", not "Withdrawn": a request also closes when its
            // person is taken off the schedule, which isn't the team's news.
            ? { label: "Closed", tone: "quiet" }
            : passed
              ? { label: "Passed", tone: "quiet" }
              : { label: "Open", tone: "open" },
    });
  }

  for (const c of claims) {
    const asker = c.request.requestedById;
    items.push({
      ...base,
      id: `schedule-sub-claim-${c.id}`,
      kind: "coverage-claimed",
      actorId: c.claimedById,
      authorId: c.claimedById,
      authorName: nameOf(c.claimedById),
      verb: asker ? `is covering for ${nameOf(asker)} at` : "is covering",
      subject: sessionTitle(programName(c.request.programSlug), c.request.sessionDate),
      href: scheduleSessionHref(hubSlug, c.request.programSlug, c.request.sessionDate),
      ts: c.createdAt.toISOString(),
      isForUser: !!asker && asker === userId && c.claimedById !== userId,
    });
  }

  for (const e of events) {
    const kind = e.kind as HubEventKind;
    const leadsOnly = LEADS_ONLY_EVENT_KINDS.includes(kind);
    const byOther = e.actorId && e.actorId !== e.subjectUserId ? nameOf(e.actorId) : null;
    const session = sessionTitle(programName(e.programSlug), e.sessionDate);
    const common = {
      ...base,
      id: `event-${e.id}`,
      kind,
      actorId: e.actorId,
      authorId: e.subjectUserId ?? e.actorId,
      href: scheduleSessionHref(hubSlug, e.programSlug, e.sessionDate),
      ts: e.createdAt.toISOString(),
      isForUser: e.subjectUserId === userId && e.actorId !== userId,
      leadsOnly,
    };
    switch (kind) {
      case "session-taken":
        items.push({ ...common, authorName: nameOf(e.subjectUserId), verb: `is ${copy.verb}`, subject: session });
        break;
      case "session-assigned":
        items.push({ ...common, authorName: nameOf(e.subjectUserId), verb: `is ${copy.verb}`, subject: session, note: byOther ? `Added by ${byOther}` : null });
        break;
      case "session-left":
        items.push({
          ...common, authorName: nameOf(e.subjectUserId), verb: `is no longer ${copy.verb}`, subject: session,
          note: byOther ? `Taken off by ${byOther}` : "Cancelled it themselves",
        });
        break;
      case "sessions-released": {
        const n = e.count ?? 0;
        const reason = releaseReason(e.detail);
        const d = e.detail && typeof e.detail === "object" ? (e.detail as Record<string, unknown>) : {};
        if (e.subjectUserId) {
          items.push({
            ...common, authorName: nameOf(e.subjectUserId),
            verb: n ? `was taken off ${plainCount(n, "upcoming session", "upcoming sessions")}` : "came off the rotations",
            subject: null,
            note: [reason, byOther && reason ? null : byOther ? `By ${byOther}` : null].filter(Boolean).join(" · ") || null,
            href: scheduleSessionHref(hubSlug, null, null),
          });
        } else if (d.reason === "schedule-changed" || d.reason === "program-no-longer-staffed") {
          items.push({
            ...common, authorName: programName(e.programSlug),
            verb: d.reason === "schedule-changed"
              ? `changed its schedule, which took ${plainCount(n, "person", "people")} off sessions`
              : `no longer needs this team, which took ${plainCount(n, "person", "people")} off sessions`,
            subject: null,
            href: scheduleSessionHref(hubSlug, null, null),
          });
        } else {
          items.push({
            ...common, authorName: nameOf(e.actorId),
            verb: e.programSlug ? `cleared the upcoming sessions of` : "cleared the team's upcoming schedule",
            subject: e.programSlug ? programName(e.programSlug) : null,
            note: n ? `${plainCount(n, "person", "people")} taken off` : null,
            href: scheduleSessionHref(hubSlug, null, null),
          });
        }
        break;
      }
      case "rotation-set":
        items.push({
          ...common, authorName: nameOf(e.subjectUserId), verb: `will be ${copy.verb}`,
          subject: `${programName(e.programSlug)}, ${rotationPhrase(e.detail)}`,
          note: byOther ? `Set by ${byOther}` : null,
          href: scheduleSessionHref(hubSlug, null, null),
        });
        break;
      case "rotation-ended":
        items.push({
          ...common, authorName: nameOf(e.subjectUserId), verb: "is off the rotation for",
          subject: `${programName(e.programSlug)}, ${rotationPhrase(e.detail)}`,
          note: [byOther ? `By ${byOther}` : null, e.count ? `${plainCount(e.count, "upcoming session", "upcoming sessions")} cleared` : null].filter(Boolean).join(" · ") || null,
          href: scheduleSessionHref(hubSlug, null, null),
        });
        break;
      default:
        break;
    }
  }
  return { items, boundary: completeDownTo([requests, claims, gaps, events], query.limit) };
}

/**
 * "Needs you": the team's sessions in the next two weeks that need someone,
 * with the cover requests among them, while they are still open (they leave
 * the moment someone takes them). Offered with a button when the viewer may
 * take sessions here (the Scheduler's own rule, canSelfClaim); a lead who
 * can't take them sees them with a link to the session.
 */
async function scheduleNeeds(query: HubAppNeedsQuery): Promise<HubAppUpdateItem[]> {
  const { hubSlug, userId } = query;
  // Who could act decides whether to build the sessions at all: this runs on
  // every team page, for the rail's number.
  const canTake = await canSelfClaim(userId, query.roles, hubSlug);
  if (!canTake && !query.isLead) return [];
  const [rows, copy, config] = await Promise.all([
    sessionsNeedingSomeone(hubSlug),
    getHubCoverageCopy(hubSlug),
    getHubCoverageConfig(hubSlug),
  ]);
  if (rows.length === 0) return [];
  const multi = config?.allowsMultipleAssignments ?? false;
  const needs = needsRoleOf(copy.noun);
  // A session that was filled and has opened again is news again: its key
  // carries the latest thing that emptied it (a "needs someone" notice, or a
  // record line naming the session; a notice alone misses a reopening within
  // a day, or one first announced beyond two weeks) or the cover request, so
  // a read mark from the last time doesn't hide it.
  const days = [...new Set(rows.flatMap((r) => (r.sessionDate ? [ctDateStr(r.sessionDate)] : [])))];
  const since = new Date(Date.now() - 60 * 86_400_000);
  const [notices, emptiers] = await Promise.all([
    db.coverageNotice.findMany({
      where: { kind: "gap-opened", hubSlug, sessionDay: { in: days } },
      select: { id: true, programSlug: true, sessionDay: true, createdAt: true },
    }),
    db.hubEvent.findMany({
      where: { hubSlug, kind: { in: ["session-left", "sessions-released", "rotation-ended", "member-left"] }, createdAt: { gte: since } },
      select: { id: true, programSlug: true, sessionDate: true, detail: true, createdAt: true },
    }),
  ]);
  const latestEmptied = new Map<string, { id: string; at: number }>();
  const note = (key: string, id: string, at: Date) => {
    const had = latestEmptied.get(key);
    if (!had || at.getTime() > had.at) latestEmptied.set(key, { id, at: at.getTime() });
  };
  for (const n of notices) if (n.programSlug && n.sessionDay) note(`${n.programSlug}~${n.sessionDay}`, n.id, n.createdAt);
  for (const e of emptiers) {
    if (e.programSlug && e.sessionDate) note(`${e.programSlug}~${ctDateStr(e.sessionDate.toISOString())}`, e.id, e.createdAt);
    const listed = e.detail && typeof e.detail === "object" ? (e.detail as Record<string, unknown>).sessions : null;
    if (Array.isArray(listed)) for (const k of listed) if (typeof k === "string") note(k, e.id, e.createdAt);
  }
  return rows
    // Your own request is yours to wait on, not to take.
    .filter((r) => !(r.status === "sub_needed" && r.hostUserId === userId))
    .flatMap((r) => {
      if (!r.sessionDate) return [];
      const date = new Date(r.sessionDate);
      const day = ctDateStr(r.sessionDate);
      const title = sessionTitle(r.programName, date);
      const cover = r.status === "sub_needed";
      const opening = cover ? `cover-${r.subRequestId}` : latestEmptied.get(`${r.programSlug}~${day}`)?.id ?? "open";
      const item: HubAppUpdateItem = {
        id: `need-${hubSlug}-${r.programSlug}~${day}-${opening}`,
        sourceKey: "app:schedule",
        sourceLabel: "Schedule",
        kind: cover ? "need-cover" : "need-someone",
        authorId: cover ? r.hostUserId : null,
        authorName: cover ? r.hostName ?? "Someone" : title,
        verb: cover ? "asked for someone to cover" : `needs ${needs}`,
        subject: cover ? title : null,
        href: scheduleSessionHref(hubSlug, r.programSlug, date),
        ts: r.sessionDate,
        isForUser: true,
        state: { label: "Open", tone: "open" },
        action: canTake
          ? {
              kind: cover ? "cover" : multi ? "sign-up" : "take",
              hubSlug,
              programSlug: r.programSlug,
              programName: r.programName,
              sessionDate: r.sessionDate,
              subRequestId: cover ? r.subRequestId : null,
              forName: cover ? r.hostName : null,
              coverageAction: copy.action,
              coverageVerb: copy.verb,
            }
          : null,
      };
      return [item];
    });
}

async function scheduleAttention(hubId: string, hubSlug: string, userId: string): Promise<HubAppAttentionItem[]> {
  const member = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId, userId } },
    select: { status: true, hostingCapability: true },
  });
  if (member?.status !== "ACTIVE" || !member.hostingCapability) return [];
  // Only requests whose session is still ahead: a passed one needs no one.
  const open = await db.subRequest.findMany({
    where: {
      status: "OPEN",
      programSlug: { notIn: await archivedProgramSlugs() },
      assignment: { hubSlug, userId: { not: userId } },
      OR: [{ sessionDate: null }, { sessionDate: { gte: ctStartOfToday() } }],
    },
    select: { sessionDate: true },
    orderBy: { sessionDate: "asc" },
  });
  const count = open.length;
  if (count === 0) return [];
  // Open the month of the soonest one, so it is on screen.
  const soonest = open.find((r) => r.sessionDate)?.sessionDate ?? null;
  return [{
    id: "schedule-open-coverage",
    sourceKey: "app:schedule",
    sourceLabel: "Scheduler",
    label: plural(count, "1 coverage request is open", `${count} coverage requests are open`),
    href: `/tools/schedule?hub=${encodeURIComponent(hubSlug)}${soonest ? `&month=${ctMonthKey(soonest)}` : ""}`,
    count,
  }];
}

const HUB_APP_PROVIDERS: Record<ToolSlug, HubAppProvider> = {
  schedule: {
    home: scheduleHome,
    updates: scheduleUpdates,
    needs: scheduleNeeds,
    attention: scheduleAttention,
  },
  programs: {
    home: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const count = await db.registration.count({
        where: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
      });
      return {
        count,
        countLabel: plural(count, "new registration in the last seven days", "new registrations in the last seven days"),
        quietText: "No new registrations in the last seven days.",
      };
    },
  },
  learning: {
    home: async () => {
      const count = await db.course.count({ where: { isActive: false } });
      return {
        count,
        countLabel: plural(count, "draft course", "draft courses"),
        quietText: "No draft courses need review.",
      };
    },
  },
};

for (const tool of TOOL_REGISTRY) {
  const provider = HUB_APP_PROVIDERS[tool.slug];
  if (tool.spaceContributions.updates && !provider.updates) {
    throw new Error(`${tool.slug} declares Space Updates but has no update provider.`);
  }
  if (tool.spaceContributions.attention && !provider.attention) {
    throw new Error(`${tool.slug} declares Space attention but has no attention provider.`);
  }
}

export function resolveRegisteredTool(link: HubAppLinkInput): ToolDefinition | null {
  return link.toolSlug ? getToolBySlug(link.toolSlug) : null;
}

/** Build Home contributions from the apps actually installed in this Space. */
export async function getHubHomeApps(hubSlug: string, links: HubAppLinkInput[]): Promise<HubHomeApp[]> {
  return Promise.all(
    links.filter((link) => link.isEnabled).map(async (link, index) => {
      const tool = resolveRegisteredTool(link);
      if (!tool) {
        return {
          key: `link-${index}-${link.href}`,
          toolSlug: null,
          label: link.label,
          path: link.href,
          description: "A link this team uses.",
          count: null,
          countLabel: null,
          quietText: "Open this connected resource.",
          isRegistered: false,
          role: "link" as const,
          homeMode: "none" as const,
        };
      }
      // Only the primary app's summary is shown (team Home's tool card), so
      // only it is asked for one.
      const contribution = link.isPrimary
        ? await HUB_APP_PROVIDERS[tool.slug].home(hubSlug)
        : { count: null, countLabel: null, quietText: "" };
      return {
        key: `app-${tool.slug}`,
        toolSlug: tool.slug,
        label: link.label || tool.label,
        path: link.href || tool.path,
        description: tool.description,
        ...contribution,
        isRegistered: true,
        role: link.isPrimary ? "primary" as const : "supporting" as const,
        homeMode: tool.spaceContributions.home,
      };
    }),
  );
}

/** App-owned update providers; the Space owns sorting and rendering. */
export async function listInstalledAppUpdates(toolSlugs: ToolSlug[], query: HubAppUpdateQuery): Promise<HubAppUpdatePage> {
  const results = await Promise.all(
    toolSlugs.map((slug) => HUB_APP_PROVIDERS[slug].updates?.(query) ?? Promise.resolve({ items: [], boundary: null })),
  );
  let boundary: Date | null = null;
  for (const r of results) if (r.boundary && (!boundary || r.boundary > boundary)) boundary = r.boundary;
  return { items: results.flatMap((r) => r.items), boundary };
}

/** What installed apps say needs the viewer now (Updates' "Needs you"). */
export async function listInstalledAppNeeds(toolSlugs: ToolSlug[], query: HubAppNeedsQuery) {
  const results = await Promise.all(
    toolSlugs.map((slug) => HUB_APP_PROVIDERS[slug].needs?.(query) ?? Promise.resolve([])),
  );
  return results.flat();
}

export async function getInstalledAppAttention(toolSlugs: ToolSlug[], hubId: string, hubSlug: string, userId: string) {
  const items = await Promise.all(
    toolSlugs.map((slug) => HUB_APP_PROVIDERS[slug].attention?.(hubId, hubSlug, userId) ?? Promise.resolve([])),
  );
  return items.flat();
}
