/**
 * POST /api/support/sync
 *
 * Triggers a manual Gmail sync. SUPPORT role required.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { syncGmailInbox } from "@/lib/supportSync";
import { db } from "@/lib/db";

const SYNC_COOLDOWN_MS = 30 * 1000; // 30 seconds between manual syncs per user

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: one manual sync per user per 30 seconds
  const cooldownKey = `support.sync.lastAt.${session.user.id}`;
  const lastSyncSetting = await db.appSetting.findUnique({ where: { key: cooldownKey } });
  if (lastSyncSetting) {
    const lastAt = new Date(lastSyncSetting.value).getTime();
    if (Date.now() - lastAt < SYNC_COOLDOWN_MS) {
      const retryAfter = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastAt)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${retryAfter}s before syncing again` },
        { status: 429 }
      );
    }
  }

  // Record sync attempt timestamp
  await db.appSetting.upsert({
    where: { key: cooldownKey },
    create: { key: cooldownKey, value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  try {
    const result = await syncGmailInbox();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
