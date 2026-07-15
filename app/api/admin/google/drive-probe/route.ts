/**
 * Shared Drive auto-provision probe — ADMIN only, POST.
 *
 * Answers one architectural question with fact instead of guesswork
 * (RIM_GoogleWorkspace.md, cutover planning): can the RIM Files service
 * account create a Shared Drive ON ITS OWN — the capability needed to
 * auto-provision a Drive per hub at hub-creation time — WITHOUT
 * domain-wide delegation (which RIM deliberately doesn't use)?
 *
 * Creates a throwaway Shared Drive → confirms the service account is an
 * organizer of what it made → deletes it. Self-cleaning (finally), and it
 * surfaces Google's real error body per step: a 403 here is the signal that
 * auto-drive-creation needs delegation, so hub storage should use
 * auto-created folders instead. Nothing real is touched.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createSharedDrive,
  deleteSharedDrive,
  getSharedDriveCapabilities,
} from "@/lib/google/drive";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; detail: string };

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps: Step[] = [];
  let driveId: string | null = null;

  try {
    // 1. The whole question: can the service account create a Shared Drive?
    const drive = await createSharedDrive("RIM auto-provision probe (auto-deleted)");
    driveId = drive.id;
    steps.push({
      name: "Create a Shared Drive",
      ok: true,
      detail: `created “${drive.name}” (${drive.id}) — auto-provisioning a Drive per hub IS possible`,
    });

    // 2. Confirm the SA actually manages what it made (else provisioning is moot).
    const caps = await getSharedDriveCapabilities(drive.id);
    const isManager = Boolean(caps.canManageMembers || caps.canDeleteDrive);
    steps.push({
      name: "Service account is organizer",
      ok: isManager,
      detail: isManager
        ? "the service account can manage the drive it created"
        : "created, but the service account isn't an organizer — it couldn't manage an auto-provisioned drive",
    });
  } catch (e) {
    steps.push({
      name: "Create a Shared Drive",
      ok: false,
      detail: `${e instanceof Error ? e.message : String(e)} — a 403 / permission error here means auto-drive-creation needs domain-wide delegation (which RIM deliberately doesn't use); use auto-created folders per hub instead`,
    });
  } finally {
    // Always remove the throwaway drive (empty, so delete is allowed).
    if (driveId) {
      try {
        await deleteSharedDrive(driveId);
        steps.push({ name: "Clean up", ok: true, detail: "probe drive deleted" });
      } catch (e) {
        steps.push({
          name: "Clean up",
          ok: false,
          detail: `could not delete the probe drive (${driveId}) — remove it by hand in Google Drive: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: steps.every((s) => s.ok), steps });
}
