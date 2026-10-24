/**
 * /tools/programs/[programSlug] — moved (2026-10-23). A program's people live
 * in the Registration app; this address, linked from old emails and
 * bookmarks, opens the same program there, keeping the team's ?hub=.
 */

import { redirect } from "next/navigation";

export default async function ProgramPeopleMovedPage({
  params,
  searchParams,
}: {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ hub?: string }>;
}) {
  const { programSlug } = await params;
  const { hub } = await searchParams;
  redirect(`/tools/registration/${encodeURIComponent(programSlug)}${hub ? `?hub=${encodeURIComponent(hub)}` : ""}`);
}
