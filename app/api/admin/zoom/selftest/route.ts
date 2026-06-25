/**
 * Zoom provisioning self-test — ADMIN only, POST.
 *
 * Exercises the full provisioning round-trip against real Zoom on a throwaway
 * meeting, then deletes it: create → re-fetch (host link + standard join link) →
 * delete. Proves the provisioning primitives + meeting settings work. The meeting
 * is always cleaned up (finally), and no tokenized values are returned to the client.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMeeting, getMeeting, deleteMeeting } from "@/lib/zoom";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; detail: string };

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const seat = process.env.ZOOM_SEAT_A_EMAIL;
  if (!seat) {
    return NextResponse.json({ error: "ZOOM_SEAT_A_EMAIL not set" }, { status: 500 });
  }
  const steps: Step[] = [];
  let meetingId: number | null = null;

  try {
    // 1. Create a throwaway meeting ~10 min out, 30 min, no recording.
    const startTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const meeting = await createMeeting({
      seatUserId: seat,
      topic: "RIM Zoom self-test (auto-deleted)",
      startTime,
      durationMinutes: 30,
      recordToCloud: false,
    });
    meetingId = meeting.id;
    steps.push({
      name: "Create meeting",
      ok: Boolean(meeting.id) && Boolean(meeting.start_url),
      detail: `meeting ${meeting.id} created · host link ${meeting.start_url ? "present" : "MISSING"}`,
    });

    // 2. Re-fetch → fresh host start_url (the just-in-time no-login host launch).
    // Compare server-side so we can confirm it actually regenerated without ever
    // sending the (tokenized) link to the client.
    const fresh = await getMeeting(meetingId);
    const regenerated = Boolean(fresh.start_url) && fresh.start_url !== meeting.start_url;
    steps.push({
      name: "Fetch fresh host link",
      ok: Boolean(fresh.start_url),
      detail: regenerated
        ? "fresh host link regenerated"
        : fresh.start_url
          ? "host link present (not regenerated)"
          : "no start_url returned",
    });

    // 3. Confirm the standard join link (what everyone uses to join, by name).
    steps.push({
      name: "Standard join link",
      ok: Boolean(fresh.join_url),
      detail: fresh.join_url ? "join link present" : "no join_url returned",
    });
  } catch (e) {
    steps.push({
      name: "Provisioning error",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  } finally {
    // Always tear down the throwaway meeting.
    if (meetingId != null) {
      try {
        await deleteMeeting(meetingId);
        steps.push({
          name: "Delete meeting (cleanup)",
          ok: true,
          detail: `meeting ${meetingId} deleted`,
        });
      } catch (e) {
        steps.push({
          name: "Delete meeting (cleanup)",
          ok: false,
          detail: `CLEANUP FAILED — delete meeting ${meetingId} manually in Zoom: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
      }
    }
  }

  const allOk = steps.length >= 4 && steps.every((s) => s.ok);
  return NextResponse.json({ ok: allOk, steps });
}
