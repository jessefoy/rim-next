import { NextRequest, NextResponse } from "next/server";
import { sendDailyChanges } from "@/lib/contentChanges";

// ─── GET /api/cron/content-changes-daily ──────────────────────────────────────
// Each evening (01:00 UTC, vercel.json: 8 PM Central in summer, 7 PM in
// winter). Jesse's email of the day's changes made through the RIM Guide
// (lib/contentChanges.ts sendDailyChanges), only when there were any.
//
// Vercel automatically passes CRON_SECRET as: Authorization: Bearer <secret>

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const listed = await sendDailyChanges();
    return NextResponse.json({ ok: true, listed });
  } catch (e) {
    // Not marked sent: tomorrow evening's email carries them.
    console.error("[cron/content-changes-daily] failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
