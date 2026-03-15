/**
 * POST /api/support/rematch
 *
 * Re-match unlinked support threads to member accounts.
 * ADMIN only.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { rematchUnlinkedThreads } from "@/lib/supportSync";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matched = await rematchUnlinkedThreads();
  return NextResponse.json({ matched });
}
