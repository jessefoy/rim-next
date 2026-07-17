/**
 * Centralized tool registry — single source of truth for all tools.
 *
 * Every tool in the system is registered here. The hub admin form uses this
 * to populate the tool picker dropdown, and the sidebar resolves tool paths
 * from it. When you create a new tool, add it here.
 *
 * `slug` must match the toolSlug used in hasToolAccess() and UserToolAccess.
 */

export const TOOL_SLUGS = ["schedule", "programs", "learning"] as const;
export type ToolSlug = (typeof TOOL_SLUGS)[number];

export interface ToolDefinition {
  slug: ToolSlug;
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
  /** Whether this app may lead a Space Home instead of being supporting-only. */
  canBePrimary: boolean;
  /** Product-level contract. Server providers live in lib/hubApps.ts. */
  spaceContributions: {
    home: "summary" | "module" | "none";
    updates: boolean;
    attention: boolean;
  };
}

export const TOOL_REGISTRY = [
  {
    slug: "schedule",
    label: "Scheduler",
    path: "/tools/schedule",
    description: "Session calendar, assignments, sub requests — scoped per hub",
    spaceMode: "multi-space",
    canBePrimary: true,
    spaceContributions: { home: "module", updates: true, attention: true },
  },
  {
    slug: "programs",
    label: "Program Manager",
    path: "/tools/programs",
    description: "Program CRUD, scheduling, registration settings",
    spaceMode: "primary-space",
    primarySpaceSlug: "registrar",
    canBePrimary: true,
    spaceContributions: { home: "summary", updates: false, attention: false },
  },
  {
    slug: "learning",
    label: "Course Manager",
    path: "/tools/learning",
    description: "Series, lessons, and course content management",
    spaceMode: "primary-space",
    primarySpaceSlug: "courses",
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
  return tool.spaceMode === "multi-space" || tool.primarySpaceSlug === hubSlug;
}

/** Human-readable installation guidance for the admin surface. */
export function toolCompatibilityNote(tool: ToolDefinition): string {
  return tool.spaceMode === "multi-space"
    ? "Can be installed in any Space; its data stays scoped to that Space."
    : `Designed for the ${tool.primarySpaceSlug} Space; it is not yet multi-Space safe.`;
}
