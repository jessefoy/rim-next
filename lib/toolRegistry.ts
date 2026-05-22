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
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    slug: "schedule",
    label: "Scheduler",
    path: "/tools/schedule",
    description: "Session calendar, assignments, sub requests — scoped per hub",
  },
  {
    slug: "programs",
    label: "Program Manager",
    path: "/tools/programs",
    description: "Program CRUD, scheduling, registration settings",
  },
  {
    slug: "learning",
    label: "Course Manager",
    path: "/tools/learning",
    description: "Series, lessons, and course content management",
  },
];

export function getToolBySlug(slug: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((t) => t.slug === slug) ?? null;
}
