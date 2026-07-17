/**
 * Centralized tool registry — single source of truth for all tools.
 *
 * Every tool in the system is registered here. The hub admin form uses this
 * to populate the tool picker dropdown, and the sidebar resolves tool paths
 * from it. When you create a new tool, add it here.
 *
 * `slug` must match the toolSlug used in hasToolAccess() and UserToolAccess.
 */

export interface ToolDefinition {
  slug: string;
  label: string;
  path: string;
  description: string;
  /**
   * Whether this app can safely operate in more than one Space. A registered
   * app is more than a sidebar link: installing it can grant tool access and
   * contribute to Home, so compatibility must be explicit.
   */
  spaceMode: "multi-space" | "primary-space";
  /** Required when spaceMode is primary-space. */
  primarySpaceSlug?: string;
  /** Server adapter used to build the app's Home contribution. */
  homeContribution: "schedule" | "programs" | "learning";
  /** Meaningful events the app can add to the shared Activity river. */
  activityContribution: "schedule" | "none";
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    slug: "schedule",
    label: "Scheduler",
    path: "/tools/schedule",
    description: "Session calendar, assignments, sub requests — scoped per hub",
    spaceMode: "multi-space",
    homeContribution: "schedule",
    activityContribution: "schedule",
  },
  {
    slug: "programs",
    label: "Program Manager",
    path: "/tools/programs",
    description: "Program CRUD, scheduling, registration settings",
    spaceMode: "primary-space",
    primarySpaceSlug: "registrar",
    homeContribution: "programs",
    activityContribution: "none",
  },
  {
    slug: "learning",
    label: "Course Manager",
    path: "/tools/learning",
    description: "Series, lessons, and course content management",
    spaceMode: "primary-space",
    primarySpaceSlug: "courses",
    homeContribution: "learning",
    activityContribution: "none",
  },
];

export function getToolBySlug(slug: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((t) => t.slug === slug) ?? null;
}

/** True when a registered app is designed to operate in this Space. */
export function isToolCompatibleWithHub(toolSlug: string, hubSlug: string): boolean {
  const tool = getToolBySlug(toolSlug);
  if (!tool) return false;
  return tool.spaceMode === "multi-space" || tool.primarySpaceSlug === hubSlug;
}

/** Human-readable installation guidance for the admin surface. */
export function toolCompatibilityNote(tool: ToolDefinition): string {
  return tool.spaceMode === "multi-space"
    ? "Can be installed in any Space; its data stays scoped to that Space."
    : `Designed for the ${tool.primarySpaceSlug} Space; it is not yet multi-Space safe.`;
}
