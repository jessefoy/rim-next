/**
 * /tools/programs/[programSlug]/edit — a program's page (2026-10-28, Phase
 * 3): its setup as plain sentences, each section with Change, which walks
 * that section's questions and says what a change would do before it's saved
 * (components/programSetup/ProgramPage.tsx). It replaced the one-page editor.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canUseProgramManager, canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { EDITOR_PROGRAM_INCLUDE, programToEditorData } from "@/lib/programEditorData";
import { choicesFrom, type SetupData } from "@/lib/programSetup";
import { setupTeams } from "@/lib/programDrafts";
import { loadPublicPrograms } from "@/lib/publicPrograms";
import { orderKey } from "@/lib/programOrder";
import { ctDateStr } from "@/lib/scheduleUtils";
import ProgramPage from "@/components/programSetup/ProgramPage";

export const dynamic = "force-dynamic";

/** The browser tab names the program. */
export async function generateMetadata({ params }: { params: Promise<{ programSlug: string }> }) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) return { title: "Programs - Tools" };
  const { programSlug } = await params;
  const p = await db.program.findUnique({ where: { slug: programSlug }, select: { name: true } });
  return { title: p ? `${p.name} - Programs` : "Programs - Tools" };
}

export default async function ProgramToolPage({ params }: { params: Promise<{ programSlug: string }> }) {
  const { programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const [program, coverageRows] = await Promise.all([
    db.program.findUnique({ where: { slug: programSlug }, include: EDITOR_PROGRAM_INCLUDE }),
    db.programCoverageHub.findMany({ where: { programSlug }, select: { hubSlug: true } }),
  ]);
  // The old category's "hide from the Programs page", which keeps its meaning.
  const oldCategory = program?.categoryId
    ? await db.programCategory.findUnique({ where: { id: program.categoryId }, select: { hideFromProgramsPage: true } })
    : null;
  if (!program) {
    return (
      <div className="ps-page">
        <div className="ps-head">
          <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
          <h1>This program isn&rsquo;t here</h1>
          <p className="ps-state">Its address may have changed. The Programs list has every program.</p>
        </div>
      </div>
    );
  }

  const [teams, listedPrograms] = await Promise.all([setupTeams(), loadPublicPrograms()]);
  // Teams that prepare: the eligible ones, plus any the program already has,
  // so a team that lost the app still shows and can be taken off.
  const missingPrep = program.helpers.map((h) => h.hubId).filter((id) => !teams.prepare.some((t) => t.id === id));
  if (missingPrep.length) {
    teams.prepare.push(...(await db.hub.findMany({ where: { id: { in: missingPrep } }, select: { id: true, slug: true, name: true } })));
  }

  const values = programToEditorData(program, coverageRows.map((r) => r.hubSlug));
  const data: SetupData = {
    ...values,
    recurrenceUntil: values.recurrenceUntil ?? "",
    listFirst: values.listFirst ?? false,
    setup: { ...choicesFrom(values), noTeacher: values.programTeachers.length === 0 },
  };

  // The people registered, for those who can open Registration (Programs
  // shows no one's count otherwise), counted as a notice's email goes: one
  // per address, everyone with a place.
  const canSeePeople = canUseRegistration(session.user.roles);
  const registeredCount = canSeePeople
    ? new Set(
        (await db.registration.findMany({ where: { programSlug, status: { in: ["REGISTERED", "APPROVED"] } }, select: { email: true } }))
          .map((r) => r.email.trim().toLowerCase()),
      ).size
    : null;

  return (
    <ProgramPage
      data={data}
      teams={teams}
      canDecideAskers={canSeePeople}
      canManage={canUseProgramManager(session.user.roles)}
      registeredCount={registeredCount}
      archived={!!program.archivedAt}
      categoryHidden={!!oldCategory?.hideFromProgramsPage}
      listed={listedPrograms
        .filter((p) => p.slug !== programSlug)
        .map((p) => ({ name: p.name, category: p.offering.category ?? "", key: orderKey(p), when: p.dateText ?? "" }))}
      today={ctDateStr(new Date().toISOString())}
    />
  );
}
