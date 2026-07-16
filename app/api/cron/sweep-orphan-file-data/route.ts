import { NextResponse } from "next/server";
import { sweepOrphanFileData } from "@/lib/googleFiles";

/**
 * Daily cron: clear RIM per-file state (comments + attribution/draft/pending
 * meta) for files permanently deleted directly in Google Drive — the tidy-up
 * for the admin escape hatch around governed deletion (RIM_GoogleWorkspace.md).
 * Only confirmed-gone (404) files are purged; trashed-but-recoverable files and
 * transient errors are left alone. The audit log is never swept. Capped per run
 * — it does a Drive lookup per tracked file, so it needs real headroom, not the
 * trivial default the DB-only crons use.
 *
 * Schedule: see vercel.json. Vercel passes CRON_SECRET as Authorization: Bearer.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const r = await sweepOrphanFileData();
  console.log(
    `[sweep-orphan-file-data] checked ${r.checked} file(s); purged ${r.purgedFiles} gone (${r.comments} comment(s) + ${r.metas} meta row(s))${r.capped ? " — capped this run, more next run" : ""}`,
  );
  return NextResponse.json({ ok: true, ...r });
}
