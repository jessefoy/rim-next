/**
 * POST /api/support/sync
 *
 * Triggers a manual Gmail sync. SUPPORT role required.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { syncGmailInbox } from "@/lib/supportSync";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncGmailInbox();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
