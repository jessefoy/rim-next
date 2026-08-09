import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasConcludedOneTime } from "@/lib/programUtils";

// Daily retirement pass for one-time programs (backlog 2026-08-07-008,
// session 172). A one-time program (no recurrence) whose CT day has fully
// passed is archived automatically, unless the editor opted out via
// hideWhenPast on the Visibility tab. The public listings already drop these
// at read time the moment the date passes (hasConcludedOneTime); this cron
// makes the state true in the database the next morning, so the Program
// Manager's Active list shows only what's actually alive. Fully reversible —
// Restore lives on the Archived tab.
//
// Recurring programs are never touched: hasConcludedOneTime is false for any
// program with a recurrenceFreq. Registrations, dana follow-up counts, and
// the member's own history page all survive archiving.
//
// Schedule: see vercel.json. Vercel passes CRON_SECRET as
// Authorization: Bearer <secret>.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Candidates: one-time, dated, not already archived, not opted out. The CT
  // day comparison can't be expressed in the where-clause, so filter in JS —
  // the candidate set is a handful of rows.
  const candidates = await db.program.findMany({
    where: {
      archivedAt: null,
      hideWhenPast: true,
      recurrenceFreq: null,
      startDatetime: { not: null },
    },
    select: {
      id: true,
      slug: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
    },
  });

  const concluded = candidates.filter(hasConcludedOneTime);

  if (concluded.length > 0) {
    await db.program.updateMany({
      where: { id: { in: concluded.map((p) => p.id) } },
      data: { archivedAt: new Date() },
    });
    for (const p of concluded) {
      console.log(`[archive-concluded-programs] archived "${p.slug}"`);
    }
  }

  console.log(
    `[archive-concluded-programs] ${concluded.length} program(s) archived (${candidates.length} candidate(s) checked).`,
  );
  return NextResponse.json({ ok: true, archived: concluded.map((p) => p.slug) });
}
