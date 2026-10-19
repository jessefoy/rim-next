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
// The Memberstack migration adds a third exemption: imported legacy accounts
// (isLegacyUnclaimed = true) sit in the quiet pool with no role/hub by design
// and must survive until their owner logs in and is promoted.
// A fifth (2026-10-19): anyone an admin linked another way: a teacher (profile,
// program or lesson), a household member, a hand-granted course, someone on
// the schedule or a rotation, or who started a conversation. A bare record
// with only notes or tags is not staging and is still removed.
// A fourth (2026-10-13): anyone who has registered for a program. Registering
// as a guest creates an agreed, unverified account (the form carries the
// agreements), which looked exactly like an abandoned /join and was deleted
// after 48h, detaching the person from their registrations. Kept whatever the
// registration's status: it is their history with RIM.
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
      isLegacyUnclaimed: false,          // …or imported from Memberstack (quiet pool)
      registrations: { none: {} },       // …or registered for any program
      // …or set up by an admin in other ways (2026-10-19 audit): a teacher
      // attached to a program or lesson, a family member added to a household,
      // a course granted by hand. These are staged people too, and deleting
      // them took the link with them.
      isTeacher: false,
      teacherProfile: null,
      programTeachers: { none: {} },
      lessonTeachers: { none: {} },
      household: null,
      courseAccess: { none: {} },
      hubThreads2: { none: {} },         // …or started a team conversation
      hostAssignments: { none: {} },     // …or is on the schedule, or a rotation
      standingAssignments: { none: {} }, //   (a rotation row would also refuse the delete)
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
