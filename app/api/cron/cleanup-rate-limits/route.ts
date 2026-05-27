import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Daily cron: remove expired RateLimitWindow rows so the table stays
// small. Lazy reset on read means stale rows are harmless functionally,
// but at scale they'd waste storage and slow the unique-key lookup.
//
// Schedule: see vercel.json — runs at 5:15 AM CT (10:15 UTC), after the
// cleanup-incomplete-accounts cron. Vercel passes CRON_SECRET as
// Authorization: Bearer <secret>.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await db.rateLimitWindow.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  console.log(`[cleanup-rate-limits] Deleted ${count} expired window(s).`);
  return NextResponse.json({ ok: true, deleted: count });
}
