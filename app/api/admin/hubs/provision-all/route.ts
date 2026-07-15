/**
 * POST /api/admin/hubs/provision-all — ADMIN only.
 *
 * Backfill Files storage for EVERY existing hub in one action: create each
 * unmapped hub's folder in the "RIM — Spaces" container drive and map it, so
 * Files is universal across teams without clicking through each hub (the
 * finish-sequence "auto-provision every existing hub" step). New hubs already
 * provision on creation; this catches the ones that predate that.
 *
 * Idempotent: a hub that already has a drive mapping (auto or a manual
 * own-drive) is left unchanged. Open-to-all Spaces (Community) are SKIPPED —
 * their Files ride the name-resolved "RIM — Community" Drive, not a container
 * folder, so they must never be mapped to the container.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { provisionHubSpaceStorage } from "@/lib/googleFiles";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Only admins can set up hub files." }, { status: 403 });
  }

  const hubs = await db.hub.findMany({
    where: { status: "ACTIVE", openToAllMembers: false },
    select: { id: true, name: true, googleDriveId: true, googleRootFolderId: true },
    orderBy: { name: "asc" },
  });

  const results: { name: string; ok: boolean; alreadyMapped?: boolean; error?: string }[] = [];
  for (const hub of hubs) {
    try {
      const r = await provisionHubSpaceStorage(hub, session.user.id);
      results.push(
        r.ok
          ? { name: hub.name, ok: true, alreadyMapped: r.alreadyMapped }
          : { name: hub.name, ok: false, error: r.error },
      );
    } catch (e) {
      console.error("[provision-all]", hub.name, e instanceof Error ? e.message : e);
      results.push({ name: hub.name, ok: false, error: "provisioning failed" });
    }
  }

  const provisioned = results.filter((r) => r.ok && !r.alreadyMapped).length;
  const already = results.filter((r) => r.ok && r.alreadyMapped).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    total: hubs.length,
    provisioned,
    already,
    failedCount: failed.length,
    failed, // name + error for any that couldn't be set up (e.g. container drive missing)
  });
}
