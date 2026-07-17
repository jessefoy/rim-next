import { db } from "@/lib/db";
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
  homeMode: "summary" | "module" | "none";
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

async function scheduleHome(hubSlug: string): Promise<HomeContribution> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { allowsMultipleAssignments: true },
  });
  if (hub?.allowsMultipleAssignments) {
    return {
      count: null,
      countLabel: null,
      quietText: "Open the Scheduler to see this Space’s upcoming coverage.",
    };
  }
  const [count, copy] = await Promise.all([
    db.hostAssignment.count({
      where: {
        hubSlug,
        userId: null,
        sessionDate: { gte: new Date(), lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      },
    }),
    getHubCoverageCopy(hubSlug),
  ]);
  return {
    count,
    countLabel: plural(count, `open ${copy.noun} slot`, `open ${copy.noun} slots`),
    quietText: `No open ${copy.noun.toLowerCase()} slots in the next two weeks.`,
  };
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

  const [requests, claims] = await Promise.all([
    query.filter === "for-me" && !canRespond
      ? Promise.resolve([])
      : db.subRequest.findMany({
          where: {
            assignment: {
              hubSlug: query.hubSlug,
              ...(query.filter === "for-me" ? { userId: { not: query.userId } } : {}),
            },
            ...(query.filter === "for-me" ? { status: "OPEN" } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            programSlug: true,
            sessionDate: true,
            createdAt: true,
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
          assignment: {
            hubSlug: query.hubSlug,
            ...(query.filter === "for-me" ? { userId: query.userId } : {}),
          },
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

  return [
    ...requests.map((request) => ({
      id: `schedule-sub-${request.id}`,
      sourceKey: "app:schedule" as const,
      sourceLabel: "Scheduler",
      kind: "coverage-requested",
      authorId: request.assignment.userId,
      authorName: personName(request.assignment.user),
      verb: "requested coverage for",
      subject: `${programNameBySlug.get(request.programSlug) ?? request.programSlug} · ${sessionLabel(request.sessionDate)}`,
      href: `/tools/schedule?hub=${encodeURIComponent(query.hubSlug)}`,
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
      href: `/tools/schedule?hub=${encodeURIComponent(query.hubSlug)}`,
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
  const count = await db.subRequest.count({
    where: {
      status: "OPEN",
      assignment: { hubSlug, userId: { not: userId } },
    },
  });
  if (count === 0) return [];
  return [{
    id: "schedule-open-coverage",
    sourceKey: "app:schedule",
    sourceLabel: "Scheduler",
    label: plural(count, "1 coverage request is open", `${count} coverage requests are open`),
    href: `/tools/schedule?hub=${encodeURIComponent(hubSlug)}`,
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
        countLabel: plural(count, "new registration", "new registrations"),
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
          description: "A link connected to this Space.",
          count: null,
          countLabel: null,
          quietText: "Open this connected resource.",
          isRegistered: false,
          role: "link" as const,
          homeMode: "none" as const,
        };
      }
      const contribution = await HUB_APP_PROVIDERS[tool.slug].home(hubSlug);
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
