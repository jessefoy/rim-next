"use server";

/**
 * Starting a program being set up (2026-10-28, Phase 2): a shape, a copy or
 * nothing makes a draft, and the walk-through opens on it. A form posts this,
 * never a link, so nothing makes a draft by being looked at.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUsePrograms } from "@/lib/toolAuth";
import { startingSetup } from "@/lib/programDrafts";

export async function startDraft(formData: FormData) {
  const session = await auth();
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) redirect("/tools/programs");
  const shape = String(formData.get("shape") ?? "") || null;
  const copy = String(formData.get("copy") ?? "") || null;
  const start = await startingSetup({ id: session.user.id, roles: session.user.roles ?? [] }, { shape, copy });
  if ("error" in start) redirect(`/tools/programs/new?missing=${encodeURIComponent(copy ?? "")}`);
  const draft = await db.programDraft.create({
    data: { createdById: session.user.id, data: start.data as object, shape: start.shape, copiedFrom: start.copiedFrom },
    select: { id: true },
  });
  redirect(`/tools/programs/drafts/${draft.id}`);
}
