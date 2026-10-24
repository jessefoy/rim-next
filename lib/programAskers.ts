/**
 * The people and teams who can ask a program's registration questions, for
 * the public form, the update page and the helpers' pages (2026-10-24, Phase
 * 3 slice 2). The rule itself is pure, in lib/questionAskers.ts; this reads
 * the program's teachers and its supporting teams.
 *
 * A supporting team counts as the editor counts it in its "Asked by" choices
 * (components/registrar/ProgramEditor.tsx askerOptions): active, not a
 * hosting-style team, using the Scheduler, not the program's hosting team,
 * and staffing the program's format. A coverage row outside that rule (left
 * by a change to the team's formats) doesn't ask, so the editor and the form
 * always agree.
 */

import { db } from "@/lib/db";
import type { AskerContext } from "@/lib/questionAskers";

const DEFAULT_HOSTING_HUB_SLUG = "host-team";

export async function loadAskerContext(program: {
  id: string;
  slug: string;
  programFormat: string;
  hostingHubSlug: string | null;
}): Promise<AskerContext> {
  const [teachers, coverage] = await Promise.all([
    db.programTeacher.findMany({
      where: { programId: program.id },
      orderBy: { order: "asc" },
      select: { user: { select: { firstName: true, lastName: true, preferredName: true } } },
    }),
    db.programCoverageHub.findMany({ where: { programSlug: program.slug }, select: { hubSlug: true } }),
  ]);
  const hosting = program.hostingHubSlug || DEFAULT_HOSTING_HUB_SLUG;
  const hubs = coverage.length
    ? await db.hub.findMany({
        where: { slug: { in: coverage.map((c) => c.hubSlug) }, status: "ACTIVE" },
        select: {
          id: true,
          slug: true,
          name: true,
          hasSchedule: true,
          appliesToFormats: true,
          appLinks: { where: { toolSlug: "schedule", isEnabled: true }, select: { id: true }, take: 1 },
        },
        orderBy: { name: "asc" },
      })
    : [];
  return {
    teacherNames: teachers
      .map((t) => `${t.user.preferredName || t.user.firstName || ""} ${t.user.lastName || ""}`.trim())
      .filter(Boolean),
    teams: hubs
      .filter((h) => !h.hasSchedule && h.appLinks.length > 0 && h.slug !== hosting && h.appliesToFormats.includes(program.programFormat))
      .map((h) => ({ id: h.id, name: h.name })),
  };
}
