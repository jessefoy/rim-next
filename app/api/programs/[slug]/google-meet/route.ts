/**
 * POST /api/programs/[slug]/google-meet
 *
 * Creates a Google Meet space for a program and writes the link back to Sanity.
 * REGISTRAR or ADMIN only.
 *
 * Request body:
 *   { volunteerEmail: string }   — @rootedinmindfulness.org address of the volunteer host
 *
 * Response:
 *   { meetLink: string, roomEmail: string, moderationEnabled: boolean }
 *
 * Errors:
 *   400 — missing volunteerEmail, or program has no startDatetime
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
  req: NextRequest,
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

  // Parse body
  let volunteerEmail: string;
  try {
    const body = await req.json();
    volunteerEmail = (body.volunteerEmail ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!volunteerEmail) {
    return NextResponse.json({ error: "volunteerEmail is required" }, { status: 400 });
  }

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
      volunteerEmail,
      programSlug: slug,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    if (msg.startsWith("NO_ROOM_AVAILABLE")) {
      return NextResponse.json(
        { error: "All meeting rooms are booked at that time. Try a different time or add more room accounts." },
        { status: 409 }
      );
    }
    console.error("[google-meet route] createMeeting error:", err);
    return NextResponse.json(
      { error: "Failed to create Google Meet. Check server logs." },
      { status: 500 }
    );
  }

  // Write the Meet link back to Sanity
  try {
    await sanityClient
      .patch(program._id)
      .set({
        zoomLink: result.meetLink,
        zoomLinkText: "Join on Google Meet",
      })
      .commit();
  } catch (err) {
    // Non-fatal: return the link anyway so staff can copy it manually
    console.error("[google-meet route] Sanity write-back error:", err);
    return NextResponse.json({
      meetLink: result.meetLink,
      roomEmail: result.roomEmail,
      moderationEnabled: result.moderationEnabled,
      warning: "Meet created but Sanity write-back failed. Copy the link and add it manually.",
    });
  }

  return NextResponse.json({
    meetLink: result.meetLink,
    roomEmail: result.roomEmail,
    moderationEnabled: result.moderationEnabled,
  });
}
