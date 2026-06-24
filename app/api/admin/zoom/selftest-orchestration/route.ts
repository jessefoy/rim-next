/**
 * Zoom orchestration self-test — ADMIN only, POST.
 *
 * Verifies the DB-backed per-occurrence layer (lib/sessionMeeting) on a synthetic
 * test occurrence, then tears it down: provision (create row + Zoom meeting on a
 * free seat) → call again to confirm it REUSES the same meeting (idempotent) →
 * delete (Zoom meeting + row). The teardown always runs in a finally. Touches no
 * real program (uses a dedicated test slug).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateSessionMeeting,
  deleteSessionMeeting,
} from "@/lib/sessionMeeting";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; detail: string };

const TEST_SLUG = "zoom-orchestration-selftest";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Far-future synthetic occurrence so it can never overlap a real session's
  // window (and thus never occupies a seat a live session needs). Deleted in the
  // finally regardless.
  const sessionDate = new Date("2099-01-01T12:00:00.000Z");
  const endTime = new Date("2099-01-01T12:30:00.000Z");
  const topic = "RIM orchestration self-test (auto-deleted)";
  const steps: Step[] = [];

  try {
    // 1. Provision — create the row + a Zoom meeting on a free seat.
    const first = await getOrCreateSessionMeeting({
      programSlug: TEST_SLUG,
      sessionDate,
      endTime,
      topic,
    });
    steps.push({
      name: "Provision occurrence",
      ok: Boolean(first.zoomMeetingId),
      detail: `created on a seat · zoom meeting ${first.zoomMeetingId}`,
    });

    // 2. Call again — must reuse the same meeting (idempotent), not create a 2nd.
    const second = await getOrCreateSessionMeeting({
      programSlug: TEST_SLUG,
      sessionDate,
      endTime,
      topic,
    });
    const reused =
      second.id === first.id && second.zoomMeetingId === first.zoomMeetingId;
    steps.push({
      name: "Reuse (idempotent)",
      ok: reused,
      detail: reused
        ? "second call returned the same meeting"
        : "DIFFERENT meeting returned — not idempotent",
    });
  } catch (e) {
    steps.push({
      name: "Orchestration error",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  } finally {
    // Always tear down the test occurrence.
    try {
      const removed = await deleteSessionMeeting(TEST_SLUG, sessionDate);
      steps.push({
        name: "Teardown",
        ok: true,
        detail: removed ? "Zoom meeting + row deleted" : "nothing to delete",
      });
    } catch (e) {
      steps.push({
        name: "Teardown",
        ok: false,
        detail: `CLEANUP FAILED — remove the test row/meeting manually: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });
    }
  }

  const allOk = steps.length >= 3 && steps.every((s) => s.ok);
  return NextResponse.json({ ok: allOk, steps });
}
