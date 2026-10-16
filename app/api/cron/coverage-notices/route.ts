import { NextResponse } from "next/server";
import { runDailyCoverageNotices } from "@/lib/coverageNotices";

// Daily coverage notices (2026-10-16, Jesse's rulings): two days before a
// session, its people are reminded and the team's coordinators hear about
// anything still open; on Mondays each team hears about the next two weeks'
// open sessions. Runs after the rotation pass (apply-standing-assignments,
// 08:00 UTC) so rotation-filled sessions aren't reported as open. Each notice
// is recorded, so a second run the same day sends nothing new.
// lib/coverageNotices.ts. Vercel passes CRON_SECRET as Authorization: Bearer.

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const counts = await runDailyCoverageNotices();
  console.log("[cron coverage-notices]", counts);
  return NextResponse.json({ ok: true, ...counts });
}
