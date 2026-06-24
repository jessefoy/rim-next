/**
 * GET /session/[slug]/enter — Zoom entry for pilot programs.
 *
 * For a `useZoom` program, this gates the caller (auth + time window + session
 * ban), provisions/reuses the occurrence's Zoom meeting, and 302-redirects:
 *   - the assigned host (or ADMIN/GT) → a fresh no-login host start link;
 *   - everyone else → their own named registrant join link (no Zoom account).
 *
 * Non-Zoom programs fall through to the existing LiveKit room (/session/[slug]),
 * which is left completely untouched. Registration stays UI-gated, matching
 * today's behavior (the dashboard only surfaces "Join" to eligible members).
 *
 * Host identity note: the pilot uses the one-click start link (host shows as the
 * pool seat). Own-name hosting via the Claim-Host key is the next refinement.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveSessionWindow } from "@/lib/sessionWindow";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { getOrCreateSessionMeeting } from "@/lib/sessionMeeting";
import { getMeeting, addMeetingRegistrant } from "@/lib/zoom";
import { FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const dash = (q: string) => NextResponse.redirect(new URL(`/account/dashboard${q}`, req.url));

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      useZoom: true,
      programFormat: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
    },
  });
  if (!program) return dash("");

  // Not a Zoom program → the existing LiveKit room handles it, untouched.
  if (!program.useZoom) {
    return NextResponse.redirect(new URL(`/session/${slug}`, req.url));
  }

  // ── Time-window gate (ADMIN/GT bypass, mirroring the LiveKit token route).
  const isAdminOrGT = roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER");
  const window = getActiveSessionWindow(program);
  let sessionDateIso: string;
  let endTime: Date;
  if (window.active) {
    sessionDateIso = window.sessionDate;
    endTime = window.endsAt;
  } else if (isAdminOrGT) {
    // Bypass: synthesize a window from the next/now so admins can test anytime.
    sessionDateIso = window.nextSessionDate ?? new Date().toISOString();
    endTime = new Date(new Date(sessionDateIso).getTime() + FALLBACK_DURATION_MIN * 60_000);
  } else {
    return dash("?session=closed");
  }
  const sessionDate = new Date(sessionDateIso);

  // ── Session ban (members by id; ADMIN/GT exempt — same as the token route).
  if (!isAdminOrGT) {
    const roomName = `${slug}-${sessionDateIso.slice(0, 10)}`;
    const ban = await db.sessionBan.findFirst({
      where: { roomName, identity: userId },
    });
    if (ban) return dash("?session=removed");
  }

  // Everything that touches Zoom is wrapped so a busy-seat (NoSeatAvailableError),
  // a misconfiguration, or a Zoom REST hiccup lands the member calmly back on the
  // dashboard instead of a raw 500 mid-join. (Also covers a duplicate-registrant
  // error on a repeat join.)
  try {
    // ── Provision (or reuse) the occurrence's Zoom meeting.
    const meeting = await getOrCreateSessionMeeting({
      programSlug: slug,
      sessionDate,
      endTime,
      topic: program.name,
    });

    // ── Host vs member. The assigned host (or ADMIN/GT safety override) gets the
    // host start link; everyone else gets a named member join link.
    const role = await resolveSessionRole(userId, slug, sessionDateIso, roles);
    const isHost = role.isSessionHost || role.hasEndAllAuthority;

    if (isHost) {
      // Fresh start_url (Zoom regenerates it on GET; expires ~2h from fetch).
      const fresh = await getMeeting(meeting.zoomMeetingId);
      return NextResponse.redirect(fresh.start_url);
    }

    // Member → named registrant join link (real name, no Zoom account).
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, preferredName: true, email: true },
    });
    const reg = await addMeetingRegistrant(meeting.zoomMeetingId, {
      email: user?.email ?? session.user.email ?? `${userId}@rim.invalid`,
      firstName: (user?.preferredName || user?.firstName || "RIM").trim(),
      lastName: (user?.lastName || "Member").trim(),
    });
    return NextResponse.redirect(reg.join_url);
  } catch (e) {
    console.error("[session/enter] Zoom provisioning/mint failed", { slug, userId }, e);
    return dash("?session=error");
  }
}
