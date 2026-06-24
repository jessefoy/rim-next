/**
 * /session/[slug]/enter — Zoom entry for pilot (useZoom) programs.
 *
 * Gates the caller (auth + time window + session ban), provisions/reuses the
 * occurrence's Zoom meeting, registers the caller under their REAL NAME (no Zoom
 * account), and then:
 *   - member → forwards straight into Zoom (the "Opening Zoom…" launcher);
 *   - host (assigned host or ADMIN/GT) → a "Join as host" screen: they join under
 *     their own name via the same named link, then tap Participants → Claim Host
 *     and enter the code. So the host shows as THEMSELVES and holds host controls
 *     — no pool-seat identity, no Zoom login.
 *
 * Non-Zoom programs fall through to the existing LiveKit room, untouched.
 * Registration stays UI-gated (dashboard only surfaces Join to eligible members).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveSessionWindow } from "@/lib/sessionWindow";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { getOrCreateSessionMeeting } from "@/lib/sessionMeeting";
import { addMeetingRegistrant, ensureSeatHostKey } from "@/lib/zoom";
import { roomNameForProgram } from "@/lib/livekit";
import { FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import ZoomLaunch from "@/components/session/ZoomLaunch";

export const dynamic = "force-dynamic";

const HOST_KEY = process.env.ZOOM_HOST_KEY;

export default async function ZoomEnterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");
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
  if (!program) redirect("/account/dashboard");
  // Not a Zoom program → the existing LiveKit room handles it, untouched.
  if (!program.useZoom) redirect(`/session/${slug}`);

  // ── Time-window gate (ADMIN/GT bypass, mirroring the LiveKit token route).
  const isAdminOrGT = roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER");
  const win = getActiveSessionWindow(program);
  let sessionDateIso: string;
  let endTime: Date;
  if (win.active) {
    sessionDateIso = win.sessionDate;
    endTime = win.endsAt;
  } else if (isAdminOrGT) {
    sessionDateIso = win.nextSessionDate ?? new Date().toISOString();
    endTime = new Date(new Date(sessionDateIso).getTime() + FALLBACK_DURATION_MIN * 60_000);
  } else {
    redirect("/account/dashboard?session=closed");
  }
  const sessionDate = new Date(sessionDateIso);

  // ── Session ban (members by id; ADMIN/GT exempt).
  if (!isAdminOrGT) {
    const roomName = roomNameForProgram(slug, sessionDateIso);
    const ban = await db.sessionBan.findFirst({
      where: { roomName, identity: userId },
    });
    if (ban) redirect("/account/dashboard?session=removed");
  }

  // Everything that touches Zoom is wrapped so a busy-seat, misconfig, or Zoom
  // hiccup lands the caller calmly back on the dashboard instead of a raw 500.
  try {
    const meeting = await getOrCreateSessionMeeting({
      programSlug: slug,
      sessionDate,
      endTime,
      topic: program.name,
    });

    // Register the caller under their real name → their personal join link.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, preferredName: true, email: true },
    });
    const reg = await addMeetingRegistrant(meeting.zoomMeetingId, {
      email: user?.email ?? session.user.email ?? `${userId}@rim.invalid`,
      firstName: (user?.preferredName || user?.firstName || "RIM").trim(),
      lastName: (user?.lastName || "Member").trim(),
    });

    const role = await resolveSessionRole(userId, slug, sessionDateIso, roles);
    const isHost = role.isSessionHost || role.hasEndAllAuthority;

    // Member → straight into Zoom under their own name.
    if (!isHost) {
      return <ZoomLaunch url={reg.join_url} programName={program.name} />;
    }

    // Host → set the seat's host key (so Claim Host works), then show the
    // join-as-yourself screen with the code.
    let hostKey: string | null = null;
    if (HOST_KEY) {
      await ensureSeatHostKey(meeting.seatUserId, HOST_KEY);
      hostKey = HOST_KEY;
    }
    return <HostLanding programName={program.name} joinUrl={reg.join_url} hostKey={hostKey} />;
  } catch (e) {
    console.error("[session/enter] Zoom provisioning/mint failed", { slug, userId }, e);
    redirect("/account/dashboard?session=error");
  }
}

function HostLanding({
  programName,
  joinUrl,
  hostKey,
}: {
  programName: string;
  joinUrl: string;
  hostKey: string | null;
}) {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "var(--card-shadow)",
          padding: "32px 28px",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-label)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--rim-mid)",
            marginBottom: 8,
          }}
        >
          You&rsquo;re hosting
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-h2)",
            fontWeight: 400,
            margin: "0 0 20px",
          }}
        >
          {programName}
        </h1>

        <a
          href={joinUrl}
          style={{
            display: "inline-block",
            background: "var(--rim-blue)",
            color: "#fff",
            fontSize: "var(--text-body)",
            fontWeight: 600,
            padding: "12px 28px",
            borderRadius: 999,
            textDecoration: "none",
          }}
        >
          Join as host →
        </a>

        {hostKey ? (
          <div
            style={{
              marginTop: 24,
              padding: "16px 18px",
              background: "var(--rim-bg)",
              borderRadius: 10,
              fontSize: "var(--text-ui)",
              lineHeight: "var(--lh-body)",
              color: "var(--rim-text)",
            }}
          >
            You&rsquo;ll join under your own name. To take host controls, tap{" "}
            <strong>Participants → Claim Host</strong> in Zoom and enter:
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-h2)",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--rim-blue)",
              }}
            >
              {hostKey}
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 20, fontSize: "var(--text-small)", color: "var(--rim-mid)" }}>
            You&rsquo;ll join under your own name. (Host code isn&rsquo;t configured —
            set <code>ZOOM_HOST_KEY</code> to enable one-tap Claim&nbsp;Host.)
          </p>
        )}
      </div>
    </div>
  );
}
