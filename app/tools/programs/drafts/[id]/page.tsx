/**
 * /tools/programs/drafts/[id] — setting up a program, step by step
 * (2026-10-28, Phase 2): the walk-through and its review, for a draft.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { setupTeams } from "@/lib/programDrafts";
import { loadPublicPrograms } from "@/lib/publicPrograms";
import { orderKey } from "@/lib/programOrder";
import { ctDateStr } from "@/lib/scheduleUtils";
import { SHAPES } from "@/lib/programShapes";
import type { SetupData } from "@/lib/programSetup";
import ProgramSetup from "@/components/programSetup/ProgramSetup";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) return { title: "Programs - Tools" };
  const { id } = await params;
  const draft = await db.programDraft.findUnique({ where: { id }, select: { data: true } });
  const name = (draft?.data as { name?: string } | undefined)?.name?.trim();
  return { title: `${name || "A new program"} (draft) - Tools` };
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running its layout.
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();
  const { id } = await params;

  const draft = await db.programDraft.findUnique({ where: { id } });
  if (!draft) {
    return (
      <div className="ps-page">
        <div className="ps-head">
          <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
          <h1>This draft isn&rsquo;t here any more</h1>
          <p className="ps-state">It may have been published or discarded. Published programs are in the Programs list.</p>
        </div>
      </div>
    );
  }

  const [teams, listedPrograms] = await Promise.all([setupTeams(), loadPublicPrograms()]);
  const startedAs = draft.copiedFrom
    ? draft.copiedFrom
    : draft.shape
      ? `the ${SHAPES.find((s) => s.code === draft.shape)?.name ?? draft.shape} shape`
      : null;

  return (
    <ProgramSetup
      draftId={draft.id}
      initial={draft.data as unknown as SetupData}
      teams={teams}
      canDecideAskers={canUseRegistration(session.user.roles)}
      listed={listedPrograms.map((p) => ({
        name: p.name,
        category: p.offering.category ?? "",
        key: orderKey(p),
        when: p.dateText ?? "",
      }))}
      today={ctDateStr(new Date().toISOString())}
      startedAs={startedAs}
    />
  );
}
