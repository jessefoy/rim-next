/**
 * Google Drive round-trip self-test — ADMIN only, POST.
 *
 * Exercises the exact operations the Files system depends on, against a
 * throwaway file, then deletes it: find a Shared Drive → create a Google Doc
 * in it → set the anyone-with-link editor permission (the link-as-key model,
 * AND the probe for the org's "distributing content outside" policy — the one
 * Admin-console setting that could refuse an external actor like the service
 * account, see RIM_GoogleWorkspace.md §5) → delete. The file is always cleaned
 * up (finally), and Google's real error bodies are surfaced per step.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  GOOGLE_MIME,
  createFile,
  permanentlyDeleteFile,
  setAnyoneWithLinkEditor,
} from "@/lib/google/drive";
import { resolveSpacesContainerDrive } from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; detail: string };

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps: Step[] = [];
  let fileId: string | null = null;

  try {
    // 1. Find the "RIM — Spaces" container drive — the ONLY drive this test
    // writes into. No fallback to an arbitrary drive: if cleanup ever failed,
    // a stray world-editable test file must not land in a real (possibly
    // sensitive) team's drive.
    const drive = await resolveSpacesContainerDrive();
    steps.push({
      name: "Find the Spaces container drive",
      ok: Boolean(drive),
      detail: drive
        ? `using “${drive.name}”`
        : "no “RIM — Spaces” drive visible — create it in Google Drive and add the service account as a Manager",
    });
    if (!drive) return NextResponse.json({ ok: false, steps });

    // 2. Create a throwaway Google Doc in the drive's root.
    const file = await createFile({
      name: "RIM connection self-test (auto-deleted)",
      mimeType: GOOGLE_MIME.doc,
      parentId: drive.id,
    });
    fileId = file.id;
    // createFile throws on any failure, so reaching here means it succeeded.
    steps.push({
      name: "Create a Google Doc",
      ok: true,
      detail: `created · editor link ${file.webViewLink ? "present" : "MISSING"}`,
    });

    // 3. The policy probe: anyone-with-link editor permission.
    try {
      await setAnyoneWithLinkEditor(file.id);
      steps.push({
        name: "Link-as-key permission",
        ok: true,
        detail: "anyone-with-link (editor) accepted — sharing policy is compatible",
      });
    } catch (e) {
      steps.push({
        name: "Link-as-key permission",
        ok: false,
        detail: `${e instanceof Error ? e.message : String(e)} — likely the Admin-console “Distributing content outside” setting; see RIM_GoogleWorkspace.md §5`,
      });
    }
  } catch (e) {
    steps.push({
      name: "Drive error",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  } finally {
    // Always tear down the throwaway file.
    if (fileId) {
      try {
        await permanentlyDeleteFile(fileId);
        steps.push({ name: "Clean up", ok: true, detail: "test file deleted" });
      } catch (e) {
        steps.push({
          name: "Clean up",
          ok: false,
          detail: `could not delete test file: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: steps.every((s) => s.ok), steps });
}
