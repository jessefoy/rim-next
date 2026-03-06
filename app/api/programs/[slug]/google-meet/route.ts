/**
 * POST /api/programs/[slug]/google-meet
 *
 * Creates a Google Meet space for a program and writes the link + host account
 * back to Sanity. REGISTRAR or ADMIN only.
 *
 * No request body required — the system auto-selects an available room.
 *
 * Response:
 *   { meetLink: string, roomEmail: string }
 *
 * Errors:
 *   400 — program has no startDatetime
 *   401 — not authenticated
 *   403 — insufficient role
 *   404 — program not found in Sanity
 *   409 — no room accounts available at that time slot
 *   500 — Meet/Calendar API failure
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { createMeeting } from "@/lib/google-meet";

const programForMeetQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id,
  name,
  startDatetime,
  endDatetime
}`;

interface SanityProgramForMeet {
  _id: string;
  name: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Auth check
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAuthorized = session.user.roles?.some((r) =>
    ["REGISTRAR", "ADMIN"].includes(r)
  );
  if (!isAuthorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  // Fetch program from Sanity
  const program = await sanityClient.fetch<SanityProgramForMeet | null>(
    programForMeetQuery,
    { slug }
  );

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  if (!program.startDatetime) {
    return NextResponse.json(
      { error: "Program has no Start Date & Time set. Add one in Sanity Studio first." },
      { status: 400 }
    );
  }

  // Default endDatetime to 1 hour after start if not set
  const endDatetime =
    program.endDatetime ??
    new Date(new Date(program.startDatetime).getTime() + 60 * 60 * 1000).toISOString();

  // Create the meeting
  let result;
  try {
    result = await createMeeting({
      title: program.name,
      startDatetime: program.startDatetime,
      endDatetime,
      programSlug: slug,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    if (msg.startsWith("NO_ROOM_AVAILABLE")) {
      return NextResponse.json(
        { error: "All meeting rooms are booked at that time. Try a different time or ask an admin to add more room accounts." },
        { status: 409 }
      );
    }
    // Surface the actual Google API error message so it's visible in the UI
    const detail =
      (err as any)?.response?.data?.error?.message ??
      (err as any)?.response?.data?.error_description ??
      (err as Error).message ??
      "Unknown error";
    console.error("[google-meet route] createMeeting error:", err);
    return NextResponse.json(
      { error: `Meet creation failed: ${detail}` },
      { status: 500 }
    );
  }

  // Write the Meet link and assigned room account back to Sanity
  try {
    await sanityClient
      .patch(program._id)
      .set({
        zoomLink: result.meetLink,
        meetHostAccount: result.roomEmail,
      })
      .commit();
  } catch (err) {
    // Non-fatal: return the result anyway so registrar can copy it manually
    console.error("[google-meet route] Sanity write-back error:", err);
    return NextResponse.json({
      meetLink: result.meetLink,
      roomEmail: result.roomEmail,
      warning: "Meet created but Sanity write-back failed. Copy the link and add it manually in Sanity Studio.",
    });
  }

  return NextResponse.json({
    meetLink: result.meetLink,
    roomEmail: result.roomEmail,
  });
}
