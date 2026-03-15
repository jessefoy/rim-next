/**
 * GET /api/cron/support-sync
 *
 * Cron job: sync Gmail inbox for support hub.
 * Runs every 5 minutes via vercel.json.
 * Vercel auto-passes CRON_SECRET as Authorization: Bearer <secret>.
 */

import { NextRequest, NextResponse } from "next/server";
import { syncGmailInbox } from "@/lib/supportSync";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGmailInbox();
    console.log(
      `[support-sync] newThreads=${result.newThreads} newMessages=${result.newMessages} updatedThreads=${result.updatedThreads}`
    );
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[support-sync] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
