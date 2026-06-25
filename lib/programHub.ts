/**
 * Program → Hub lookup helpers.
 *
 * Every program has a hosting hub. By default this is `host-team` (RIM's
 * operational host volunteer team), but the `Program.hostingHubSlug` column
 * lets a coordinator transfer hosting authority to a different hub —
 * `peer-led-silent-meditation` for community-led silent sits, future hubs
 * for Recovery Dharma, skills classes, etc.
 *
 * Two reads on the hub matter for slice-1 behaviour:
 *
 *   `assignmentGrantsTeacher`  When true, an active HostAssignment for a
 *                              program in this hub confers teacher
 *                              capability on the assignee (bell-friendly
 *                              audio, Teacher pill, End-for-All fallback).
 *                              Peer-led offerings opt in; host-team keeps
 *                              the default false.
 *
 *   `teacherLabel`             Default pill text when the hub grants
 *                              teacher capability. The pill hierarchy is
 *                              `program.teacherLabel ?? hub.teacherLabel
 *                              ?? "Teacher"` — most specific wins.
 *
 * Why slug, not FK? `HostAssignment.programSlug` already uses slug as the
 * join key. Programs and hubs share that convention; slugs are stable once
 * assignments exist (per CLAUDE.md). A FK would have to be nullable too,
 * which gives us the same migration profile without the cascade complexity.
 */

import { db } from "@/lib/db";

/** The implicit default hub when `Program.hostingHubSlug` is null. */
export const DEFAULT_HOSTING_HUB_SLUG = "host-team" as const;

/** Resolved hosting hub info for a program, including teacher-capability flags. */
export interface ProgramHostingHub {
  /** The effective slug — always populated. `null` source resolves to host-team. */
  hubSlug: string;
  /** True when an assignment from this hub confers teacher capability. */
  assignmentGrantsTeacher: boolean;
  /** Default pill text when the hub grants teacher capability. */
  hubTeacherLabel: string | null;
}

/**
 * Look up the effective hosting hub slug for a program. Always returns a
 * string — `null` in the column resolves to `host-team`.
 *
 * Used by capability gates that don't need the hub config record
 * (e.g. notification-recipient lookups).
 */
export async function getProgramHubSlug(programSlug: string): Promise<string> {
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: { hostingHubSlug: true },
  });
  return program?.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
}

/**
 * Look up the effective hosting hub *and* its teacher-capability flags for a
 * program. Returns null only when the program doesn't exist; otherwise always
 * returns a resolved record, falling back to host-team-with-defaults when the
 * column is null.
 *
 * Used by `resolveSessionRole` (the session-role resolver) for the host/teacher
 * label hierarchy and the hub-grants-teacher capability path.
 */
export async function getProgramHostingHub(
  programSlug: string,
): Promise<ProgramHostingHub | null> {
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      hostingHubSlug: true,
    },
  });
  if (!program) return null;

  const resolvedSlug = program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;

  const hub = await db.hub.findUnique({
    where: { slug: resolvedSlug },
    select: { assignmentGrantsTeacher: true, teacherLabel: true },
  });

  // If the resolved hub doesn't exist (shouldn't happen — host-team is seeded,
  // and the editor pulls the dropdown from db.hub.findMany) we degrade to safe
  // defaults rather than throw. The Teacher pill stays at "Teacher", no hub
  // grants kick in. Coordinator's editor warning surfaces the orphan, if any.
  return {
    hubSlug: resolvedSlug,
    assignmentGrantsTeacher: hub?.assignmentGrantsTeacher ?? false,
    hubTeacherLabel: hub?.teacherLabel ?? null,
  };
}

/**
 * Resolve the pill text that should render on a teacher's tile in the session
 * room. Hierarchy: program override → hub default → built-in "Teacher".
 *
 * Returns `null` when the result is the built-in default — callers seed the
 * `teacherLabel` field into participant metadata only when non-null, so the
 * client falls through to the default string. This keeps the wire payload
 * minimal and lets the renderer own the literal.
 */
export function resolveTeacherPillLabel(
  programTeacherLabel: string | null,
  hubTeacherLabel: string | null,
): string | null {
  return programTeacherLabel ?? hubTeacherLabel ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// Auxiliary-hub coverage (session 129 — AV + Greeter hubs).
//
// A program has one primary hosting hub (above) plus zero-or-more auxiliary
// hubs that schedule supporting roles for it. Auxiliary hubs are joined via
// the `ProgramCoverageHub` table; the program's slug is the join key.
// ───────────────────────────────────────────────────────────────────────────

/**
 * List the slugs of every auxiliary hub providing coverage for a program.
 * Does not include the primary hub. Returns [] when nothing's configured.
 *
 * Used by the Scheduler page to union primary + auxiliary programs for the
 * active hub's view, and by the ProgramEditor's "Hosting & Access" tab to
 * pre-populate the checkbox list.
 */
export async function getProgramCoverageHubs(
  programSlug: string,
): Promise<string[]> {
  const rows = await db.programCoverageHub.findMany({
    where: { programSlug },
    select: { hubSlug: true },
  });
  return rows.map((r) => r.hubSlug);
}

/**
 * The reverse direction: list every program slug that a given hub covers
 * (whether primary or auxiliary). Used by the Scheduler page query.
 *
 * The result is the union of:
 *   1. Programs where `hostingHubSlug` equals this hub (or null + this is host-team)
 *   2. Programs that have an explicit `ProgramCoverageHub` row pointing here
 */
export async function getProgramSlugsForHub(hubSlug: string): Promise<string[]> {
  const primaryFilter = hubSlug === DEFAULT_HOSTING_HUB_SLUG
    ? { OR: [{ hostingHubSlug: null }, { hostingHubSlug: DEFAULT_HOSTING_HUB_SLUG }] }
    : { hostingHubSlug: hubSlug };

  const [primaryRows, coverageRows] = await Promise.all([
    db.program.findMany({
      // `hostingRequired: true` excludes "No host needed" programs from their
      // PRIMARY hosting hub's view (host-team / peer-led) — a self-led offering
      // (Recovery Dharma, drop-in groups) never surfaces as "Needs Coverage"
      // there. It does NOT touch auxiliary coverage (below): "No host needed"
      // governs the primary host only; AV/greeter coverage is an independent
      // per-hub decision.
      where: { ...primaryFilter, archivedAt: null, hostingRequired: true },
      select: { slug: true },
    }),
    db.programCoverageHub.findMany({
      where: { hubSlug },
      select: { programSlug: true },
    }),
  ]);

  const slugs = new Set<string>();
  for (const p of primaryRows) slugs.add(p.slug);

  // Auxiliary coverage (AV / greeter): filter archived only, NOT hostingRequired.
  // "No host needed" scopes to the primary host — it must not strip explicitly-
  // configured supporting-role coverage. A self-led in-person group that a
  // coordinator put on greeter coverage still appears in the greeter scheduler.
  const coverageSlugs = coverageRows.map((c) => c.programSlug);
  if (coverageSlugs.length > 0) {
    const liveCoverage = await db.program.findMany({
      where: { slug: { in: coverageSlugs }, archivedAt: null },
      select: { slug: true },
    });
    for (const p of liveCoverage) slugs.add(p.slug);
  }

  return [...slugs];
}

/**
 * True when a program needs scheduled host coverage (the default). False means
 * the program is flagged "No host needed" (self-led / community-led) — used by
 * the Scheduler mutation guards (assignment claim, rotation save) to refuse
 * creating coverage state for a self-led program even via a crafted request.
 * Unknown / missing program → true (fail safe: assume it needs a host).
 */
export async function programNeedsHost(programSlug: string): Promise<boolean> {
  const p = await db.program.findUnique({
    where: { slug: programSlug },
    select: { hostingRequired: true },
  });
  return p?.hostingRequired ?? true;
}

/** Resolved coverage config for one hub in one place — fetched once per page. */
export interface HubCoverageConfig {
  slug: string;
  appliesToFormats: string[];
  allowsMultipleAssignments: boolean;
}

/** Role-aware copy strings for one hub. Session 130 follow-up — UI and email
 *  copy that used to hardcode "host" now reads from these. Defaults preserve
 *  host-team language. */
export interface HubCoverageCopy {
  noun:   string; // "Host" / "AV" / "Greeter" / "Facilitator"
  verb:   string; // "hosting" / "covering AV" / "greeting" / "facilitating"
  action: string; // "host this" / "cover AV" / "greet" / "facilitate"
}

export const DEFAULT_COVERAGE_COPY: HubCoverageCopy = {
  noun:   "Host",
  verb:   "hosting",
  action: "host this",
};

/**
 * Load role-aware copy for a hub. Returns defaults ("Host" / "hosting" /
 * "host this") when the hub doesn't exist or its config is missing. UI
 * surfaces (Schedule cards, toasts) and email builders read from this
 * so each hub speaks its own language without code branches per hub.
 * Configured per-hub via `/admin/hubs` and seeded by the migration
 * `add_hub_coverage_copy_v1`.
 */
export async function getHubCoverageCopy(hubSlug: string): Promise<HubCoverageCopy> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { coverageNoun: true, coverageVerb: true, coverageAction: true },
  });
  if (!hub) return DEFAULT_COVERAGE_COPY;
  return {
    noun:   hub.coverageNoun   ?? DEFAULT_COVERAGE_COPY.noun,
    verb:   hub.coverageVerb   ?? DEFAULT_COVERAGE_COPY.verb,
    action: hub.coverageAction ?? DEFAULT_COVERAGE_COPY.action,
  };
}

/**
 * Load coverage-relevant config for a hub. Returns null when the hub doesn't
 * exist (caller decides whether that's an error or a fallthrough to defaults).
 *
 * Used by the Scheduler page (format filter), the assignments POST (multi-claim
 * gate), and the standing-assignments routes.
 */
export async function getHubCoverageConfig(
  hubSlug: string,
): Promise<HubCoverageConfig | null> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { slug: true, appliesToFormats: true, allowsMultipleAssignments: true },
  });
  if (!hub) return null;
  return {
    slug: hub.slug,
    appliesToFormats: hub.appliesToFormats ?? ["virtual", "hybrid"],
    allowsMultipleAssignments: hub.allowsMultipleAssignments ?? false,
  };
}
