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
 * Used by `/api/livekit/token`, `/api/livekit/step-in`, and `resolveSessionRole`
 * for the pill label hierarchy and the hub-grants-teacher capability path.
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
