import { NextResponse } from "next/server";
import { sendDailySummaries } from "@/lib/notificationsSummary";

// The once-a-day summary of team news (2026-10-20), for people who chose it
// in My Profile. Runs after the coverage notices (13:00 UTC), so the
// morning's notices are in it. lib/notificationsSummary.ts. Vercel passes
// CRON_SECRET as Authorization: Bearer.

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const counts = await sendDailySummaries();
  console.log("[cron notifications-summary]", counts);
  return NextResponse.json({ ok: true, ...counts });
}
