import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Daily cron: remove User records whose threshold/sign-in never completed.
//
// Two paths catch the same lifecycle gap from opposite ends:
//
//   1. User exists but agreedToTerms = false and was created > 48h ago.
//      Pre-/join path: someone hit /login as a brand-new visitor (no /join
//      page run), NextAuth created the User row at sign-in, but they never
//      finished /account/welcome and never accepted the agreements.
//
//   2. User exists with agreedToTerms = true but emailVerified IS NULL and
//      was created > 48h ago. /join path: they submitted the /join form
//      (so we wrote agreedToTerms + name), but never typed the 6-digit code
//      to verify the email. Without this branch these accounts linger
//      indefinitely.
//
// 48h gives a generous tail for someone who genuinely intended to finish
// but got distracted; emails take seconds, so anything older than this is
// abandoned, not in-flight.
//
// Staged-account guard: an admin can deliberately pre-stage a person before
// they ever log in — create their account, give them a role, add them to a
// hub, put them on the schedule (so emailVerified is null AND agreedToTerms is
// false, looking exactly like an abandoned signup). Those accounts MUST
// survive until the person onboards. So we never delete an account that holds
// a role OR belongs to a hub — only genuinely-untouched abandoned signups.
// (Relation filters like `hubMemberships: { none }` aren't supported in
// deleteMany, so we resolve ids with findMany first, then delete by id.)
//
// Schedule: see vercel.json. Vercel passes CRON_SECRET as
// Authorization: Bearer <secret>.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  const abandoned = await db.user.findMany({
    where: {
      createdAt: { lt: cutoff },
      roles: { isEmpty: true },          // never GC someone an admin gave a role
      hubMemberships: { none: {} },      // …or added to a hub (staged volunteers)
      OR: [
        // Path 1 — never agreed
        { agreedToTerms: false },
        // Path 2 — agreed via /join but never verified the code
        { agreedToTerms: true, emailVerified: null },
      ],
    },
    select: { id: true },
  });

  const { count } = abandoned.length
    ? await db.user.deleteMany({ where: { id: { in: abandoned.map((u) => u.id) } } })
    : { count: 0 };

  console.log(`[cleanup-incomplete-accounts] Deleted ${count} incomplete account(s).`);
  return NextResponse.json({ ok: true, deleted: count });
}
