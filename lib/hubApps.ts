import { db } from "@/lib/db";
import { ctMonthKey, ctStartOfToday } from "@/lib/timezone";
import { countSessionsNeedingSomeone, LOOKAHEAD_DAYS, sessionHasSomeone } from "@/lib/coverageNotices";
import { getHubCoverageCopy } from "@/lib/programHub";
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

export interface HubAppUpdateItem {
  id: string;
  sourceKey: `app:${ToolSlug}`;
  sourceLabel: string;
  kind: string;
  authorId: string | null;
  authorName: string;
  verb: string;
  subject: string | null;
  href: string;
  ts: string;
  isForUser: boolean;
}

export interface HubAppUpdateQuery {
  hubId: string;
  hubSlug: string;
  userId: string;
  cursorDate: Date | null;
  recentSince: Date;
  filter: "all" | "recent" | "for-me";
  limit: number;
}

type HomeContribution = Pick<HubHomeApp, "count" | "countLabel" | "quietText">;

interface HubAppProvider {
  home(hubSlug: string): Promise<HomeContribution>;
  updates?(query: HubAppUpdateQuery): Promise<HubAppUpdateItem[]>;
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

function sessionLabel(date: Date | null): string {
  if (!date) return "an upcoming session";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  });
}

function createdAtWindow(query: HubAppUpdateQuery) {
  const gt = query.filter === "recent" ? query.recentSince : undefined;
  const lt = query.cursorDate ?? undefined;
  return gt || lt ? { ...(gt ? { gt } : {}), ...(lt ? { lt } : {}) } : undefined;
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

async function scheduleUpdates(query: HubAppUpdateQuery): Promise<HubAppUpdateItem[]> {
  const createdAt = createdAtWindow(query);
  const membership = query.filter === "for-me"
    ? await db.hubMember.findUnique({
        where: { hubId_userId: { hubId: query.hubId, userId: query.userId } },
        select: { status: true, hostingCapability: true },
      })
    : null;
  const canRespond = membership?.status === "ACTIVE" && membership.hostingCapability;

  // A request still needs someone only while its session is ahead (2026-10-15:
  // a passed, uncovered request stayed "open" for good).
  const today = ctStartOfToday();
  const archived = query.filter === "for-me" ? await archivedProgramSlugs() : [];
  const [requests, claims] = await Promise.all([
    query.filter === "for-me" && !canRespond
      ? Promise.resolve([])
      : db.subRequest.findMany({
          where: {
            assignment: {
              hubSlug: query.hubSlug,
              ...(query.filter === "for-me" ? { userId: { not: query.userId } } : {}),
            },
            ...(query.filter === "for-me"
              ? { status: "OPEN", programSlug: { notIn: archived }, OR: [{ sessionDate: null }, { sessionDate: { gte: today } }] }
              : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            programSlug: true,
            sessionDate: true,
            createdAt: true,
            requestedById: true,
            assignment: {
              select: {
                userId: true,
                user: { select: { firstName: true, lastName: true, preferredName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: query.limit,
        }),
    db.subClaim.findMany({
      where: {
        request: {
          assignment: { hubSlug: query.hubSlug },
          // "For me": a claim on a request I asked for. The assignment's user
          // becomes the person covering, so the asker is requestedById.
          ...(query.filter === "for-me" ? { requestedById: query.userId } : {}),
        },
        ...(query.filter === "for-me" ? { claimedById: { not: query.userId } } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      select: {
        id: true,
        claimedById: true,
        createdAt: true,
        claimedBy: { select: { firstName: true, lastName: true, preferredName: true } },
        request: { select: { programSlug: true, sessionDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    }),
  ]);

  const programSlugs = [...new Set([
    ...requests.map((request) => request.programSlug),
    ...claims.map((claim) => claim.request.programSlug),
  ])];
  const programs = programSlugs.length
    ? await db.program.findMany({
        where: { slug: { in: programSlugs } },
        select: { slug: true, name: true },
      })
    : [];
  const programNameBySlug = new Map(programs.map((program) => [program.slug, program.name]));
  // Who asked: requestedById, else (older rows) the assignment's user.
  const askerIds = [...new Set(requests.map((r) => r.requestedById).filter((x): x is string => !!x))];
  const askers = askerIds.length
    ? await db.user.findMany({
        where: { id: { in: askerIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const askerById = new Map(askers.map((u) => [u.id, u]));
  const monthHref = (d: Date | null) =>
    `/tools/schedule?hub=${encodeURIComponent(query.hubSlug)}${d ? `&month=${ctMonthKey(d)}` : ""}`;

  // A session losing its last person (coverage_notices, 2026-10-16): the
  // assignment it came from is gone, so the notice is the record. Names no
  // one: who cancelled, or why, isn't the team's news; that it needs someone is.
  const gaps = query.filter === "for-me" && !canRespond
    ? []
    : await db.coverageNotice.findMany({
        where: {
          kind: "gap-opened",
          hubSlug: query.hubSlug,
          ...(query.filter === "for-me" ? { sessionDate: { gte: today }, programSlug: { notIn: archived } } : {}),
          ...(createdAt ? { createdAt } : {}),
        },
        select: { id: true, programSlug: true, sessionDate: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: query.limit,
      });
  // "For me" is what still needs someone: a gap someone has since filled
  // leaves it (the cover requests beside it are OPEN only). All and Recent
  // keep it as history.
  if (query.filter === "for-me") {
    const stillOpen = await Promise.all(
      gaps.map((g) => g.programSlug && g.sessionDate ? sessionHasSomeone(query.hubSlug, g.programSlug, g.sessionDate).then((x) => !x) : Promise.resolve(false)),
    );
    gaps.splice(0, gaps.length, ...gaps.filter((_, i) => stillOpen[i]));
  }
  const gapCopy = gaps.length ? await getHubCoverageCopy(query.hubSlug) : null;
  const gapPrograms = gaps.length
    ? new Map((await db.program.findMany({
        where: { slug: { in: [...new Set(gaps.map((g) => g.programSlug).filter((x): x is string => !!x))] } },
        select: { slug: true, name: true },
      })).map((p) => [p.slug, p.name]))
    : new Map<string, string>();

  return [
    ...gaps.map((gap) => ({
      id: `schedule-gap-${gap.id}`,
      sourceKey: "app:schedule" as const,
      sourceLabel: "Scheduler",
      kind: "coverage-gap",
      authorId: null,
      authorName: `${gapPrograms.get(gap.programSlug ?? "") ?? gap.programSlug ?? "A session"} · ${sessionLabel(gap.sessionDate)}`,
      verb: `needs ${needsRoleOf(gapCopy?.noun ?? "Host")}`,
      subject: null,
      href: monthHref(gap.sessionDate),
      ts: gap.createdAt.toISOString(),
      isForUser: query.filter === "for-me",
    })),
    ...requests.map((request) => ({
      id: `schedule-sub-${request.id}`,
      sourceKey: "app:schedule" as const,
      sourceLabel: "Scheduler",
      kind: "coverage-requested",
      authorId: request.requestedById ?? request.assignment.userId,
      authorName: personName(
        request.requestedById ? askerById.get(request.requestedById) : request.assignment.user,
      ),
      verb: "requested coverage for",
      subject: `${programNameBySlug.get(request.programSlug) ?? request.programSlug} · ${sessionLabel(request.sessionDate)}`,
      href: monthHref(request.sessionDate),
      ts: request.createdAt.toISOString(),
      isForUser: query.filter === "for-me",
    })),
    ...claims.map((claim) => ({
      id: `schedule-sub-claim-${claim.id}`,
      sourceKey: "app:schedule" as const,
      sourceLabel: "Scheduler",
      kind: "coverage-claimed",
      authorId: claim.claimedById,
      authorName: personName(claim.claimedBy),
      verb: "claimed coverage for",
      subject: `${programNameBySlug.get(claim.request.programSlug) ?? claim.request.programSlug} · ${sessionLabel(claim.request.sessionDate)}`,
      href: monthHref(claim.request.sessionDate),
      ts: claim.createdAt.toISOString(),
      isForUser: query.filter === "for-me",
    })),
  ];
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
export async function listInstalledAppUpdates(toolSlugs: ToolSlug[], query: HubAppUpdateQuery) {
  const results = await Promise.all(
    toolSlugs.map((slug) => HUB_APP_PROVIDERS[slug].updates?.(query) ?? Promise.resolve([])),
  );
  return results.flat();
}

export async function getInstalledAppAttention(toolSlugs: ToolSlug[], hubId: string, hubSlug: string, userId: string) {
  const items = await Promise.all(
    toolSlugs.map((slug) => HUB_APP_PROVIDERS[slug].attention?.(hubId, hubSlug, userId) ?? Promise.resolve([])),
  );
  return items.flat();
}
