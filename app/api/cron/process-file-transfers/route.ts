import { NextResponse } from "next/server";
import { findTransfersToProcess, processFileTransfer, sweepFailedTransferBlobs } from "@/lib/googleFileTransfer";

// Daily cron: the backstop for Blob→Drive uploads (RIM_GoogleWorkspace.md,
// Slice 3). The common case completes synchronously via after() right after
// the Blob upload webhook fires; this catches anything that didn't (a
// function timeout, a cold-start crash, a transient Drive error) and retries
// it, plus sweeps the staging blob for any transfer that has permanently
// failed. Capped per run — a member-scale filing system has no need for
// unbounded per-invocation Drive traffic. maxDuration matches the upload
// route's ceiling: each transfer here does the identical Blob-fetch +
// Drive-upload work, so this route needs the same headroom, not the trivial
// default the other (DB-only) crons get away with.
//
// Schedule: see vercel.json. Vercel passes CRON_SECRET as
// Authorization: Bearer <secret>.

export const maxDuration = 300;

const BATCH_SIZE = 25;
/** A handful concurrently — Drive's quotas are far above RIM's scale
 *  (RIM_GoogleWorkspace.md §5), so this only needs to keep wall-clock
 *  reasonable, not protect against rate limits. */
const CONCURRENCY = 5;

async function processInChunks(ids: string[], size: number): Promise<void> {
  for (let i = 0; i < ids.length; i += size) {
    await Promise.all(ids.slice(i, i + size).map((id) => processFileTransfer(id)));
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await findTransfersToProcess(BATCH_SIZE);
  await processInChunks(
    pending.map((t) => t.id),
    CONCURRENCY,
  );
  const blobsCleaned = await sweepFailedTransferBlobs(BATCH_SIZE);

  console.log(
    `[process-file-transfers] processed ${pending.length} transfer(s), cleaned ${blobsCleaned} failed blob(s).`,
  );
  return NextResponse.json({ ok: true, processed: pending.length, blobsCleaned });
}
