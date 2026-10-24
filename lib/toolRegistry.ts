/**
 * Centralized tool registry — single source of truth for all tools.
 *
 * Every tool in the system is registered here. The hub admin form uses this
 * to populate the tool picker dropdown, and the sidebar resolves tool paths
 * from it. When you create a new tool, add it here.
 *
 * `slug` must match the toolSlug used in hasToolAccess() and UserToolAccess.
 */

export const TOOL_SLUGS = ["schedule", "programs", "registration", "learning", "helping"] as const;
export type ToolSlug = (typeof TOOL_SLUGS)[number];
export type ToolIconKey = "calendar" | "programs" | "registration" | "learning" | "helping";

export interface ToolDefinition {
  slug: ToolSlug;
  label: string;
  path: string;
  /** Stable semantic icon identity used by every Space navigation rail. */
  iconKey: ToolIconKey;
  description: string;
  /**
   * Whether this app can safely operate in more than one Space. A registered
   * app is more than a sidebar link: installing it can grant tool access and
   * contribute to Home, so compatibility must be explicit.
   */
  spaceMode: "multi-space" | "primary-space";
  /** Required when spaceMode is primary-space. */
  primarySpaceSlug?: string;
  /** Other Spaces a primary-space app may also be installed in. */
  alsoSpaceSlugs?: string[];
  /** The team Home button's words, where "Open the {label}" doesn't read
   *  ("Open Registration", not "Open the Registration"). */
  openLabel?: string;
  /** Whether this app may lead a Space Home instead of being supporting-only. */
  canBePrimary: boolean;
  /** Product-level contract. Server providers live in lib/hubApps.ts. */
  spaceContributions: {
    /** "summary": one line in the highlighted tool card on team Home (the
     *  primary app) — no app adds a module, disclosure or second card to Home
     *  (Jesse, 2026-10-13). */
    home: "summary" | "none";
    updates: boolean;
    attention: boolean;
  };
}

export const TOOL_REGISTRY = [
  {
    slug: "schedule",
    label: "Scheduler",
    path: "/tools/schedule",
    iconKey: "calendar",
    description: "Session calendar, assignments, sub requests — scoped per hub",
    spaceMode: "multi-space",
    canBePrimary: true,
    // One summary line in the highlighted tool card on team Home (2026-10-13;
    // the month overview module was retired).
    spaceContributions: { home: "summary", updates: true, attention: true },
  },
  {
    slug: "programs",
    label: "Program Manager",
    path: "/tools/programs",
    iconKey: "programs",
    description: "Program CRUD, scheduling, registration settings",
    spaceMode: "primary-space",
    primarySpaceSlug: "registrar",
    // Programs opens to the teams that set programs up (Jesse, 2026-10-24):
    // Program Central too. It isn't scoped to a team's own programs, so it
    // stays out of every other team.
    alsoSpaceSlugs: ["program-central"],
    canBePrimary: true,
    spaceContributions: { home: "summary", updates: false, attention: false },
  },
  {
    // The Registration app (2026-10-23): who's coming to each program and
    // what needs a person. Role-only like the Program Manager
    // (canUseRegistration), so team membership alone never opens it.
    slug: "registration",
    label: "Registration",
    path: "/tools/registration",
    iconKey: "registration",
    openLabel: "Open Registration",
    description: "Who's coming to each program, what needs a person, dana, notes and history",
    spaceMode: "primary-space",
    primarySpaceSlug: "registrar",
    canBePrimary: true,
    spaceContributions: { home: "summary", updates: false, attention: false },
  },
  {
    slug: "learning",
    label: "Course Manager",
    path: "/tools/learning",
    iconKey: "learning",
    description: "Series, lessons, and course content management",
    spaceMode: "primary-space",
    primarySpaceSlug: "courses",
    canBePrimary: true,
    spaceContributions: { home: "summary", updates: false, attention: false },
  },
  {
    // Helping with (2026-10-24, Phase 3 slice 5): a team that prepares for
    // programs without being on their schedule (a kitchen team) sees each
    // program it helps with, how many are coming, and the answers to its own
    // questions; contact details only where the program lets it reach people.
    // Every read is scoped by the team (program_helpers), so any team may
    // install it; the Home line counts only this team's programs.
    slug: "helping",
    label: "Helping with",
    path: "/tools/helping",
    iconKey: "helping",
    openLabel: "Open Helping with",
    description: "The programs this team prepares for: who's coming and what they told the team",
    spaceMode: "multi-space",
    canBePrimary: true,
    spaceContributions: { home: "summary", updates: false, attention: false },
  },
] satisfies readonly ToolDefinition[];

export function getToolBySlug(slug: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((t) => t.slug === slug) ?? null;
}

/** True when a registered app is designed to operate in this Space. */
export function isToolCompatibleWithHub(toolSlug: string, hubSlug: string): boolean {
  const tool = getToolBySlug(toolSlug);
  if (!tool) return false;
  return (
    tool.spaceMode === "multi-space" ||
    tool.primarySpaceSlug === hubSlug ||
    ("alsoSpaceSlugs" in tool && !!tool.alsoSpaceSlugs?.includes(hubSlug))
  );
}

/** Human-readable installation guidance for the admin surface. */
export function toolCompatibilityNote(tool: ToolDefinition): string {
  return tool.spaceMode === "multi-space"
    ? "Can be installed in any Space; its data stays scoped to that Space."
    : `Designed for the ${[tool.primarySpaceSlug, ...("alsoSpaceSlugs" in tool ? tool.alsoSpaceSlugs ?? [] : [])].join(" and ")} Space${"alsoSpaceSlugs" in tool && tool.alsoSpaceSlugs?.length ? "s" : ""}; it is not yet multi-Space safe.`;
}
