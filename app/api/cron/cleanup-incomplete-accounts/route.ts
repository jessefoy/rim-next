import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Daily cron: remove User records where agreedToTerms is false
// and the account was created more than 48 hours ago.
// These are abandoned magic-link sign-ins where the person never
// completed the community welcome step.
//
// Schedule: add to vercel.json alongside send-reminders cron.
// Vercel passes CRON_SECRET as Authorization: Bearer <secret>.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  const { count } = await db.user.deleteMany({
    where: {
      agreedToTerms: false,
      createdAt: { lt: cutoff },
    },
  });

  console.log(`[cleanup-incomplete-accounts] Deleted ${count} incomplete account(s).`);
  return NextResponse.json({ ok: true, deleted: count });
}
