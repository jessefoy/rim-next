/**
 * Shared Drives visible to the RIM Files service account — ADMIN only, GET.
 *
 * Feeds the hub-edit mapping picker so nobody ever copies a Drive ID by hand:
 * creating a Shared Drive and adding rim-files@… as a Manager is what makes it
 * appear here (RIM_GoogleWorkspace.md §7D). Read-only.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { googleConfigured } from "@/lib/google/auth";
import { listSharedDrives } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google is not configured yet — see /admin/google-test." },
      { status: 503 },
    );
  }
  try {
    const drives = await listSharedDrives();
    return NextResponse.json({ drives });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not list drives" },
      { status: 502 },
    );
  }
}
