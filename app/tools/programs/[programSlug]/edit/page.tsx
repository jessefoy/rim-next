/**
 * /tools/programs/[programSlug]/edit — Edit an existing program.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx); the guest-link
 * reset and the categories link only for canUseProgramManager.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUseProgramManager, canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";
import type { ProgramData } from "@/components/registrar/ProgramEditor";
import { EDITOR_PROGRAM_INCLUDE, programToEditorData } from "@/lib/programEditorData";

export const dynamic = "force-dynamic";

export default async function EditProgramToolPage({
  params,
}: {
  params: Promise<{ programSlug: string }>;
}) {
  const { programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const [program, categories, hubs, coverageRows] = await Promise.all([
    db.program.findUnique({
      where: { slug: programSlug },
      include: EDITOR_PROGRAM_INCLUDE,
    }),
    db.programCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    // Active hubs feed the Who's helping dropdowns. Coordinator
    // chooses which hub hosts this program's live sessions; the dropdown
    // shows every active hub so the field is discoverable as new hubs
    // come online (Silent Meditation, Recovery Dharma, etc.).
    //
    // The Auxiliary coverage section filters by `usesScheduler` — true
    // when the hub has an enabled HubAppLink with toolSlug = "schedule".
    // That's the authoritative source of "this hub uses the Scheduler"
    // (a coordinator added the link to their sidebar). Slot it as a
    // derived boolean below the findMany so the editor can filter.
    db.hub.findMany({
      where: { status: "ACTIVE" },
      select: {
        slug: true,
        name: true,
        // `hasSchedule` flags hosting-style hubs (host-team, peer-led-
        // silent-meditation) — those that run the live session, own
        // LiveKit, hold dharma authority. Only these are valid choices
        // for the "Hosting team" dropdown.
        hasSchedule: true,
        // `appliesToFormats` (virtual/hybrid for hosting hubs, in-person/
        // hybrid for AV+greeter) lets the Auxiliary fieldset filter
        // by overlap with the program's `programFormat` so a virtual-
        // only program doesn't show AV/Greeter checkboxes.
        appliesToFormats: true,
        // A Scheduler HubAppLink is the authoritative "uses the
        // Scheduler tool" signal — required for a hub to appear as
        // auxiliary coverage.
        appLinks: {
          where: { toolSlug: "schedule", isEnabled: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    // Auxiliary-coverage rows for this program (session 129). Empty array
    // when no auxiliary hubs are tagged. Editor renders these as checked
    // checkboxes in the "Auxiliary role coverage" section.
    db.programCoverageHub.findMany({
      where: { programSlug },
      select: { hubSlug: true },
    }),
  ]);

  if (!program) {
    return (
      <div className="vol-page">
        <div className="vol-content">
          <p className="vol-empty">Program not found.</p>
        </div>
      </div>
    );
  }

  // Future HostAssignment count drives the mid-flight change warning when
  // a coordinator transfers hosting to another hub. The grandfather policy
  // keeps existing future assignments valid; the warning surfaces how many
  // assignments are about to grandfather so the coordinator's decision is
  // informed. Standing rotations live in a separate table and aren't part
  // of this count — they ride forward on the new hub automatically.
  // Only the current hosting team's assignments move with a hosting-team
  // change; greeter and AV sign-ups belong to their own teams.
  const futureHostAssignmentCount = await db.hostAssignment.count({
    where: {
      programSlug,
      hubSlug: program.hostingHubSlug ?? "host-team",
      sessionDate: { gte: new Date() },
    },
  });

  const initialData: ProgramData = programToEditorData(program, coverageRows.map((r) => r.hubSlug));

  // Post a notice's "Also email the N people registered": only for those who
  // can open Registration (Programs shows no one's count otherwise), counted
  // as the notice route sends: one email per address, everyone with a place.
  const canEmailRegistered = canUseRegistration(session.user.roles);
  const registeredCount = canEmailRegistered
    ? new Set(
        (await db.registration.findMany({
          where: { programSlug, status: { in: ["REGISTERED", "APPROVED"] } },
          select: { email: true },
        })).map((r) => r.email.trim().toLowerCase()),
      ).size
    : null;

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          basePath="/tools/programs"
          initialData={initialData}
          isEditing={true}
          canManage={canUseProgramManager(session.user.roles)}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, kind: c.kind ?? null, hidden: c.hideFromProgramsPage }))}
          hubs={hubs.map((h) => ({
            slug: h.slug,
            name: h.name,
            hasSchedule: h.hasSchedule,
            appliesToFormats: h.appliesToFormats,
            usesScheduler: h.appLinks.length > 0,
          }))}
          futureHostAssignmentCount={futureHostAssignmentCount}
          canEmailRegistered={canEmailRegistered}
          registeredCount={registeredCount}
        />
      </div>
    </div>
  );
}
