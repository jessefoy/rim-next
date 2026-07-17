import { db } from "@/lib/db";
import { getHubCoverageCopy } from "@/lib/programHub";
import { getToolBySlug, type ToolDefinition } from "@/lib/toolRegistry";

export interface HubAppLinkInput {
  toolSlug: string | null;
  label: string;
  href: string;
  isEnabled: boolean;
}

export interface HubHomeApp {
  key: string;
  toolSlug: string | null;
  label: string;
  path: string;
  description: string;
  count: number | null;
  countLabel: string | null;
  quietText: string;
  isRegistered: boolean;
}

export function resolveRegisteredTool(link: HubAppLinkInput): ToolDefinition | null {
  return link.toolSlug ? getToolBySlug(link.toolSlug) : null;
}

function plural(count: number, singular: string, multiple: string) {
  return count === 1 ? singular : multiple;
}

async function registeredContribution(tool: ToolDefinition, hubSlug: string): Promise<Pick<HubHomeApp, "count" | "countLabel" | "quietText">> {
  if (tool.homeContribution === "programs") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const count = await db.registration.count({
      where: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
    });
    return {
      count,
      countLabel: plural(count, "new registration", "new registrations"),
      quietText: "No new registrations in the last seven days.",
    };
  }

  if (tool.homeContribution === "learning") {
    const count = await db.course.count({ where: { isActive: false } });
    return {
      count,
      countLabel: plural(count, "draft course", "draft courses"),
      quietText: "No draft courses need review.",
    };
  }

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
        };
      }
      const contribution = await registeredContribution(tool, hubSlug);
      return {
        key: `app-${tool.slug}`,
        toolSlug: tool.slug,
        label: link.label || tool.label,
        path: link.href || tool.path,
        description: tool.description,
        ...contribution,
        isRegistered: true,
      };
    }),
  );
}
