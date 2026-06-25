/**
 * /session/[slug]/enter — Zoom entry for pilot (useZoom) programs.
 *
 * Gates the caller (auth + time window + session ban), provisions/reuses the
 * occurrence's Zoom meeting, registers the caller under their REAL NAME (no Zoom
 * account), and then routes by role:
 *   - regular member → forwards straight into Zoom (the "Opening Zoom…" launcher),
 *     no code, no host controls.
 *   - host-capable (designated host, host-team alternate, teacher, ADMIN/GT) → a
 *     role-aware "you're entering" screen that names today's host and shows the
 *     Claim-Host code, so the right person can take host controls (and anyone on
 *     the team can step in if the designated host doesn't show). Everyone joins
 *     under their own name; whoever takes the host role types the code in Zoom.
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
import { getMeeting, ensureSeatHostKey } from "@/lib/zoom";
import { roomNameForProgram, sessionDisplayName } from "@/lib/livekit";
import { FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import ZoomLaunch from "@/components/session/ZoomLaunch";

export const dynamic = "force-dynamic";

const HOST_KEY = process.env.ZOOM_HOST_KEY;

type ViewerRole = "designated" | "teacher" | "alternate";

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
      recordByDefault: true,
      programFormat: true,
      hostingHubSlug: true,
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
    const provision = () =>
      getOrCreateSessionMeeting({
        programSlug: slug,
        sessionDate,
        endTime,
        topic: program.name,
        recordToCloud: program.recordByDefault,
      });

    // Provision/reuse the meeting and get its standard join link. We deliberately
    // do NOT pre-register each person by name — Zoom rate-limits "add registrant"
    // (~3/day per email), which broke repeat joins. Everyone uses the standard
    // join link and joins under their own name (typed once, then remembered by
    // Zoom, or their signed-in Zoom name). getMeeting also verifies the meeting
    // still exists; if a host ended/deleted it, we drop the stale row and recreate
    // once so re-entry within the window always lands in a live meeting.
    const { meeting, joinUrl } = await (async () => {
      let m = await provision();
      try {
        return { meeting: m, joinUrl: (await getMeeting(m.zoomMeetingId)).join_url };
      } catch (firstErr) {
        if (!meetingIsGone(firstErr)) throw firstErr;
        console.warn(`[session/enter] stale Zoom meeting ${m.zoomMeetingId} for ${slug}; recreating`);
        await db.sessionMeeting.delete({ where: { id: m.id } }).catch(() => {});
        m = await provision();
        return { meeting: m, joinUrl: (await getMeeting(m.zoomMeetingId)).join_url };
      }
    })();

    // Who can take host controls: the designated host, anyone on the host team
    // (alternate), the teacher, or ADMIN/GT. Everyone else is a plain member.
    const role = await resolveSessionRole(userId, slug, sessionDateIso, roles);
    const canHost =
      role.isSessionHost || role.isHostTeam || role.isProgramTeacher || role.hasEndAllAuthority;

    if (!canHost) {
      return <ZoomLaunch url={joinUrl} programName={program.name} />;
    }

    // Resolve who the designated host is (to name them for alternates/teacher).
    const designatedHostName = await getDesignatedHostName(
      slug,
      program.hostingHubSlug ?? "host-team",
      sessionDate,
      userId,
    );

    const viewerRole: ViewerRole = role.isSessionHost
      ? "designated"
      : role.isProgramTeacher
        ? "teacher"
        : "alternate";

    // Make Claim Host work: set the meeting's owning seat's host key.
    let hostKey: string | null = null;
    if (HOST_KEY) {
      await ensureSeatHostKey(meeting.seatUserId, HOST_KEY);
      hostKey = HOST_KEY;
    }

    return (
      <HostLanding
        programName={program.name}
        joinUrl={joinUrl}
        hostKey={hostKey}
        viewerRole={viewerRole}
        designatedHostName={designatedHostName}
      />
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[session/enter] Zoom provisioning/mint failed", { slug, userId }, e);
    // Admins/GT see the real error on screen so we can debug the pilot; everyone
    // else gets a calm bounce to the dashboard.
    if (isAdminOrGT) {
      return <EnterError message={message} slug={slug} />;
    }
    redirect("/account/dashboard?session=error");
  }
}

/** Admin-only error panel — surfaces the actual failure so we can fix it precisely. */
function EnterError({ message, slug }: { message: string; slug: string }) {
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
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-h3)",
            fontWeight: 400,
            marginBottom: 8,
          }}
        >
          Couldn&rsquo;t open this session
        </h1>
        <p style={{ fontSize: "var(--text-ui)", color: "var(--rim-mid)", marginBottom: 16 }}>
          Connecting to Zoom failed. (This detail is shown to admins only, to help debug.)
        </p>
        <pre
          style={{
            textAlign: "left",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            color: "var(--color-error)",
            background: "var(--rim-bg)",
            borderRadius: 8,
            padding: "12px 14px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </pre>
        <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
          <a href={`/session/${slug}/enter`} style={{ color: "var(--rim-blue)", fontWeight: 600 }}>
            Try again
          </a>
          <a href="/account/dashboard" style={{ color: "var(--rim-mid)" }}>
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * True when a Zoom error means the meeting no longer exists (ended/deleted) — a
 * 404 or Zoom code 3001 ("Meeting does not exist") — so we recreate rather than
 * fail. Transient errors (5xx / rate limit) deliberately don't match, so we
 * don't spuriously recreate a live meeting.
 */
function meetingIsGone(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /\(404\)|"code":\s*3001|does not exist|not found/i.test(m);
}

/**
 * The display name of the session's designated host (first name + last initial),
 * or null if there's no assigned host or the viewer IS the host. Mirrors
 * resolveSessionRole's occurrence matching: an exact-date assignment wins over a
 * legacy standing (null-date) one.
 */
async function getDesignatedHostName(
  programSlug: string,
  hubSlug: string,
  sessionDate: Date,
  viewerId: string,
): Promise<string | null> {
  const rows = await db.hostAssignment.findMany({
    where: {
      programSlug,
      hubSlug,
      userId: { not: null },
      OR: [{ sessionDate }, { sessionDate: null }],
    },
    select: {
      userId: true,
      sessionDate: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  const chosen =
    rows.find((r) => r.sessionDate !== null) ?? rows.find((r) => r.sessionDate === null) ?? null;
  if (!chosen?.user || chosen.userId === viewerId) return null;
  return sessionDisplayName(chosen.user, "") || null;
}

function HostLanding({
  programName,
  joinUrl,
  hostKey,
  viewerRole,
  designatedHostName,
}: {
  programName: string;
  joinUrl: string;
  hostKey: string | null;
  viewerRole: ViewerRole;
  designatedHostName: string | null;
}) {
  const eyebrow =
    viewerRole === "designated"
      ? "You're hosting today"
      : viewerRole === "teacher"
        ? "You're teaching today"
        : "You're on the host team";

  // Who's hosting (for teacher/alternate).
  const hostLine =
    viewerRole === "designated"
      ? null
      : designatedHostName
        ? `${designatedHostName} is today's host.`
        : "No one has claimed today's host role yet.";

  const claimIntro =
    viewerRole === "designated"
      ? "To take host controls, tap Participants → Claim Host in Zoom and enter:"
      : "If you need to step in as host, tap Participants → Claim Host and enter:";

  const joinLabel = viewerRole === "designated" ? "Join as host →" : "Join →";

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
          {eyebrow}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-h2)",
            fontWeight: 400,
            margin: "0 0 8px",
          }}
        >
          {programName}
        </h1>
        {hostLine && (
          <p style={{ fontSize: "var(--text-ui)", color: "var(--rim-mid)", margin: "0 0 20px" }}>
            {hostLine}
          </p>
        )}
        {!hostLine && <div style={{ height: 12 }} />}

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
          {joinLabel}
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
            You&rsquo;ll join under your own name. {claimIntro}
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
            set <code>ZOOM_HOST_KEY</code> to enable Claim&nbsp;Host.)
          </p>
        )}
      </div>
    </div>
  );
}
