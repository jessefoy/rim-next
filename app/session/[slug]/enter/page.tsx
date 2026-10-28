/**
 * /session/[slug]/enter — the single entry point for every virtual/hybrid session.
 *
 * Gates the caller (auth + time window + session ban), provisions/reuses the
 * occurrence's Zoom meeting, then routes by who they are:
 *   - guest with a valid open-access ?key= → forwarded straight into Zoom (no RIM
 *     account); a missing/invalid key falls through to sign-in.
 *   - regular member → forwards straight into Zoom (the "Opening Zoom…" launcher),
 *     no code, no host controls.
 *   - host-capable (designated host, host-team alternate, teacher, ADMIN/GT) → a
 *     role-aware "you're entering" screen that names today's host and shows the
 *     Claim-Host code, so the right person can take host controls (and anyone on
 *     the team can step in if the designated host doesn't show). Everyone joins
 *     under their own name; whoever takes the host role types the code in Zoom.
 *
 * An outside room (Program.outsideMeetingUrl: Recovery Dharma's, a
 * facilitator's own Zoom) passes the same gates, then forwards everyone,
 * hosts included, to that link: RIM creates no meeting, takes no seat and
 * shows no host code. When its program also chose "anyone may join from the
 * public page" (outsideMeetingPublic), the door admits visitors without an
 * account, still only during the session window. See lib/outsideMeeting.ts.
 *
 * Registration is checked here as well as on My Home: a registration-required
 * program admits its registrants (plus hosts, teachers, ADMIN/GT), using the
 * same rule the dashboard uses to show Join. Guests come via the shared
 * open-access link. Every stop on the way in (window closed, program ended,
 * not registered, Zoom busy or unreachable) is a plain-language page with one
 * way forward, never a silent bounce to the dashboard.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getActiveSessionWindow } from "@/lib/sessionWindow";
import { resolveSessionRole } from "@/lib/sessionAuth";
import { getOrCreateSessionMeeting, NoSeatAvailableError } from "@/lib/sessionMeeting";
import { getMeeting, ensureSeatHostKey, deleteMeeting, setMeetingTopic } from "@/lib/zoom";
import { sessionDisplayName } from "@/lib/sessionIdentity";
import { FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import { ctDateStr, shiftToDate } from "@/lib/scheduleUtils";
import { hasOpenEntry } from "@/lib/programOffering";
import { meetingServiceName, outsideRoomUrl } from "@/lib/outsideMeeting";
import ZoomLaunch from "@/components/session/ZoomLaunch";
import { ctDayBounds, fmtSessionDay } from "@/lib/timezone";
import { getHubCoverageCopy, teamPhrase } from "@/lib/programHub";
import { claimHostHelpHref } from "@/lib/tutorialLinks";

export const dynamic = "force-dynamic";

const HOST_KEY = process.env.ZOOM_HOST_KEY;

type ViewerRole = "designated" | "teacher" | "alternate";

export default async function ZoomEnterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { slug } = await params;
  const { key: guestKey } = await searchParams;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const roles = session?.user?.roles ?? [];

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      recordByDefault: true,
      programFormat: true,
      hostingHubSlug: true,
      isOpenAccess: true,
      guestAccessKey: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
      archivedAt: true,
      registrationEnabled: true,
      openEntry: true,
      outsideMeetingUrl: true,
      outsideMeetingPublic: true,
      category: { select: { slug: true, kind: true } },
    },
  });
  if (!program) redirect("/account/dashboard");

  // An archived program has no live sessions — don't provision a Zoom meeting
  // for it. Matters more now that concluded one-time programs archive
  // automatically; also closes the hand-crafted-URL path for a manually
  // archived recurring program whose old weekly window would otherwise pass
  // the time gate.
  if (program.archivedAt) {
    return (
      <EnterNotice
        title="This program has ended"
        body="It isn't meeting online anymore. Current programs are on the Programs and Events page."
        primary={{ href: "/community-programs", label: "See current programs" }}
        secondary={userId ? { href: "/account/dashboard", label: "Back to My Home" } : undefined}
      />
    );
  }

  // Only virtual/hybrid programs have an online room — a hand-crafted /enter URL
  // for an in-person program shouldn't burn a Zoom pool seat. Send them to the page.
  if (program.programFormat === "in-person") redirect(`/programs/${slug}`);

  // A guest holding a valid open-access key enters without a RIM account — they're
  // forwarded straight to the Zoom join link. Everyone else must sign in.
  // The open-access link is the program saying "anyone with this link may
  // come". It admits guests without an account, and it also lets a signed-in
  // member through the registration check below.
  const hasValidKey =
    !!guestKey &&
    program.isOpenAccess &&
    !!program.guestAccessKey &&
    guestKey === program.guestAccessKey;
  // An outside room whose program chose "anyone may join from the public
  // page" is open the same way, without a key. Never for a program that takes
  // registrations (the editor offers it only without registration).
  const outsideUrl = outsideRoomUrl(program);
  const publicDoor = !!outsideUrl && program.outsideMeetingPublic && !program.registrationEnabled;
  const hasPass = hasValidKey || publicDoor;
  const isValidGuest = !userId && hasPass;
  if (!userId && !isValidGuest) redirect("/login");

  // ── Time-window gate (ADMIN/GT bypass, mirroring the LiveKit token route).
  const isAdminOrGT = roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER");
  const win = getActiveSessionWindow(program);
  let sessionDateIso: string;
  let endTime: Date;
  if (win.active) {
    sessionDateIso = win.sessionDate;
    endTime = win.endsAt;
  } else if (isAdminOrGT) {
    // Early/late entry for testing: provision the NEXT occurrence with its real
    // length, so the meeting (and its seat reservation) matches what members
    // will get.
    sessionDateIso = win.nextSessionDate ?? new Date().toISOString();
    endTime =
      win.nextSessionDate && program.endDatetime
        ? shiftToDate(program.endDatetime.toISOString(), ctDateStr(win.nextSessionDate))
        : new Date(new Date(sessionDateIso).getTime() + FALLBACK_DURATION_MIN * 60_000);
    if (endTime <= new Date(sessionDateIso)) {
      endTime = new Date(new Date(sessionDateIso).getTime() + FALLBACK_DURATION_MIN * 60_000);
    }
  } else if (userId) {
    // Outside the entry window. Say so, instead of dropping the member on
    // their dashboard with no explanation.
    return (
      <EnterNotice
        title="This session isn't open right now"
        body="Online sessions open a few minutes before they begin. When it's time, you'll find the Join button on My Home."
        primary={{ href: "/account/dashboard", label: "Back to My Home" }}
      />
    );
  } else {
    // Guests have no dashboard: say when the room opens, and point to the
    // program page, rather than bouncing them there without a word.
    return (
      <EnterNotice
        title="This session isn't open right now"
        body={
          win.nextOpensAt
            ? `You can join from ${fmtOpensAt(win.nextOpensAt)}, Central Time.`
            : "It has no upcoming sessions. The program page has the details."
        }
        primary={{ href: `/programs/${slug}`, label: "See the program page" }}
      />
    );
  }
  const sessionDate = new Date(sessionDateIso);

  // (A session-ban check stood here: bans were written by the retired LiveKit
  // room's Remove control and keyed to that day's room, so none can match a
  // Zoom session. Removed 2026-10-19; the table drop is in CLEANUP.md.)

  const retryHref = `/session/${slug}/enter${hasValidKey ? `?key=${encodeURIComponent(guestKey!)}` : ""}`;
  const cantOpen = (busy: boolean, detail: string) => (
    <EnterNotice
      title="This session can't open right now"
      body={
        busy
          ? "All of RIM's Zoom rooms are in use at this time. Please try again in a few minutes."
          : "We couldn't reach Zoom just now. Please try again in a moment."
      }
      help
      primary={{ href: retryHref, label: "Try again" }}
      secondary={
        userId
          ? { href: "/account/dashboard", label: "Back to My Home" }
          : { href: `/programs/${slug}`, label: "Back to the program page" }
      }
      adminDetail={isAdminOrGT ? detail : undefined}
    />
  );

  // ── Who is this, and may they come in? Resolved BEFORE provisioning, so a
  // turned-away visitor never takes one of RIM's Zoom rooms.
  let role: Awaited<ReturnType<typeof resolveSessionRole>> | null = null;
  let mayEnter = true;
  try {
    role = userId ? await resolveSessionRole(userId, slug, sessionDateIso, roles) : null;
    const canHostHere =
      !!role &&
      (role.isSessionHost || role.isHostTeam || role.isProgramTeacher || role.hasEndAllAuthority);

    // A registration-required class, event, or retreat is for its
    // registrants. My Home only offers them Join, and this door agrees:
    // a program with open entry admits any member, and so does the
    // program's open-access link. The people who run the session online
    // always get in, using the same reach My Home and the Scheduler give
    // them: the HOSTING team only, by an assignment for this day (including
    // standing ones) or active membership. Greeter and AV teams serve the
    // hall and need nothing from Zoom (Jesse, 2026-10-15: AV uses the hall's
    // own logged-in computer; greeters serve in person); they enter like any
    // member (registration or open entry).
    if (
      userId &&
      !canHostHere &&
      !isAdminOrGT &&
      !hasPass &&
      !hasOpenEntry(program)
    ) {
      const occurrenceDay = ctDateStr(sessionDateIso);
      const [registration, assignments] = await Promise.all([
        db.registration.findFirst({
          where: {
            userId,
            OR: [{ programSlug: slug }, { programId: program.id }],
            // A waitlisted member has no place yet; same rule as My Home.
            status: { notIn: ["CANCELLED", "PENDING_PAYMENT", "WAITLISTED"] },
          },
          select: { id: true },
        }),
        db.hostAssignment.findMany({
          where: { userId, programSlug: slug, hubSlug: program.hostingHubSlug ?? "host-team" },
          select: { sessionDate: true },
        }),
      ]);
      const assignedToday = assignments.some(
        (a) => !a.sessionDate || ctDateStr(a.sessionDate.toISOString()) === occurrenceDay,
      );
      const staffHubs = [program.hostingHubSlug ?? "host-team"];
      const onStaffTeam =
        !registration && !assignedToday
          ? !!(await db.hubMember.findFirst({
              where: { userId, status: "ACTIVE", hub: { slug: { in: staffHubs } } },
              select: { id: true },
            }))
          : false;
      mayEnter = !!registration || assignedToday || onStaffTeam;
    }
  } catch (e) {
    console.error("[session/enter] access check failed", { slug, userId }, e);
    return cantOpen(false, e instanceof Error ? e.message : String(e));
  }
  const canHost =
    !!role &&
    (role.isSessionHost || role.isHostTeam || role.isProgramTeacher || role.hasEndAllAuthority);

  if (!mayEnter) {
    return (
      <EnterNotice
        title="This session is for registered participants"
        body="It looks like you don't have a place in this program yet. If you're on the waitlist, we'll email you when a spot opens. The program page shows how to take part."
        primary={{ href: `/programs/${slug}`, label: "See the program page" }}
        secondary={{ href: "/account/dashboard", label: "Back to My Home" }}
      />
    );
  }

  // An outside room: everyone who passed the gates goes straight to it. No RIM
  // meeting, no seat, no host code: the room is someone else's.
  if (outsideUrl) {
    return (
      <ZoomLaunch url={outsideUrl} programName={program.name} service={meetingServiceName(program)} />
    );
  }

  // Everything that touches Zoom is wrapped so a busy seat, a misconfiguration,
  // or a Zoom hiccup shows a plain "can't open right now" page with Try again,
  // instead of a raw 500.
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
      let fetched: Awaited<ReturnType<typeof getMeeting>> | null = null;
      try {
        fetched = await getMeeting(m.zoomMeetingId);
      } catch (firstErr) {
        if (!meetingIsGone(firstErr)) throw firstErr;
      }
      // Reuse only if the meeting exists AND has no registration form
      // (approval_type 2). Otherwise — gone (404), or an old registration-style
      // meeting from before the no-registration fix — recreate fresh so the link
      // goes straight in (no form). The fresh meeting is always approval_type 2,
      // so this heals once and won't loop.
      const registrationOn =
        fetched?.settings?.approval_type === 0 || fetched?.settings?.approval_type === 1;
      if (fetched && !registrationOn) {
        // A rename Zoom didn't take when it was saved (lib/programSave.ts)
        // is given now, so the room carries the program's name.
        if (fetched.topic !== program.name.slice(0, 200)) {
          await setMeetingTopic(m.zoomMeetingId, program.name).catch((err) =>
            console.error("[session/enter] meeting rename failed", m.zoomMeetingId, err),
          );
        }
        return { meeting: m, joinUrl: fetched.join_url };
      }
      console.warn(
        `[session/enter] recreating meeting for ${slug} (${fetched ? "registration-on" : "gone"})`,
      );
      // A registration-style meeting still exists on its seat; remove it so it
      // doesn't linger there, unless people are in it right now. (A gone
      // meeting has nothing to delete.)
      if (fetched && fetched.status !== "started") {
        await deleteMeeting(m.zoomMeetingId).catch((err) =>
          console.error("[session/enter] stale meeting delete failed", m.zoomMeetingId, err),
        );
      }
      await db.sessionMeeting.delete({ where: { id: m.id } }).catch(() => {});
      m = await provision();
      return { meeting: m, joinUrl: (await getMeeting(m.zoomMeetingId)).join_url };
    })();

    // Guests (no account) and plain members go straight into Zoom. Returning here
    // also narrows userId to non-null for the host path below.
    if (!userId) {
      return <ZoomLaunch url={joinUrl} programName={program.name} />;
    }

    // Who can take host controls: the designated host, anyone on the host team
    // (alternate), the teacher, or ADMIN/GT (resolved above). Everyone else is
    // a plain member.
    if (!canHost || !role) {
      return <ZoomLaunch url={joinUrl} programName={program.name} />;
    }

    // Resolve who the designated host is (to name them for alternates/teacher).
    // The hosting team's own words for the landing ("facilitating" on a
    // peer-led team; 2026-10-16 audit). Zoom's "host controls" stay Zoom's.
    const hostingSlug = program.hostingHubSlug ?? "host-team";
    const [hostingTeam, hostingCopy] = await Promise.all([
      db.hub.findUnique({ where: { slug: hostingSlug }, select: { name: true } }),
      getHubCoverageCopy(hostingSlug),
    ]);
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

    // Make Claim Host work: set the meeting's owning seat's host key. A failure
    // here must not keep the host out of the room: the seat almost always
    // already carries this key from an earlier session, so log it and go on.
    let hostKey: string | null = null;
    if (HOST_KEY) {
      try {
        await ensureSeatHostKey(meeting.seatUserId, HOST_KEY);
      } catch (err) {
        console.error("[session/enter] host key sync failed; showing the code anyway", meeting.seatUserId, err);
      }
      hostKey = HOST_KEY;
    }

    return (
      <HostLanding
        programName={program.name}
        joinUrl={joinUrl}
        hostKey={hostKey}
        viewerRole={viewerRole}
        designatedHostName={designatedHostName}
        teamName={hostingTeam?.name ?? "hosting"}
        roleVerb={hostingCopy.verb}
        helpHref={claimHostHelpHref(hostingSlug)}
        // An admin or guiding teacher entering early reaches the NEXT
        // session; it isn't "today" (walk, 2026-10-18: "You're teaching
        // today" on a Friday for Tuesday's session).
        dayWord={ctDateStr(sessionDateIso) === ctDateStr(new Date().toISOString())
          ? "today"
          : `on ${fmtSessionDay(sessionDate)}`}
        showSetup={isAdminOrGT}
      />
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[session/enter] Zoom provisioning/mint failed", { slug, userId }, e);
    // Everyone gets a plain explanation and a way to try again, instead of
    // being dropped on their dashboard. Admins/GT also see the raw error.
    return cantOpen(e instanceof NoSeatAvailableError, message);
  }
}

/**
 * A plain-language stop on the way into Zoom: what happened, and one clear way
 * forward. Used for a closed window, an ended program, and a Zoom failure.
 */
function EnterNotice({
  title,
  body,
  help = false,
  primary,
  secondary,
  adminDetail,
}: {
  title: string;
  body: string;
  /** Add the "email support and we'll help you in" line. */
  help?: boolean;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  /** The raw error, shown to ADMIN / Guiding Teacher only. */
  adminDetail?: string;
}) {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          boxSizing: "border-box",
          textAlign: "center",
          background: "var(--rim-surface)",
          // Bordered, not lifted, like every other surface (2026-10-19).
          border: "1px solid var(--rim-rule)",
          borderRadius: 12,
          padding: "32px 24px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-h3)",
            fontWeight: 400,
            margin: "0 0 12px",
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: "var(--text-app)", lineHeight: 1.55, color: "var(--rim-text)", margin: "0 0 8px" }}>
          {body}
        </p>
        {help && (
          <p style={{ fontSize: "var(--text-app)", lineHeight: 1.55, color: "var(--rim-text)", margin: "0 0 8px" }}>
            If it still won&rsquo;t open, email{" "}
            <a href="mailto:support@rootedinmindfulness.org" style={{ color: "var(--rim-blue)", overflowWrap: "anywhere" }}>
              support@rootedinmindfulness.org
            </a>{" "}
            and we&rsquo;ll help you in.
          </p>
        )}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <a
            href={primary.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              boxSizing: "border-box",
              background: "var(--rim-blue)",
              color: "var(--rim-surface)",
              fontSize: "var(--text-app)",
              fontWeight: 600,
              padding: "10px 24px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            {primary.label}
          </a>
          {secondary && (
            <a
              href={secondary.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                color: "var(--rim-blue)",
                fontSize: "var(--text-app)",
              }}
            >
              {secondary.label}
            </a>
          )}
        </div>
        {adminDetail && (
          <>
            <p style={{ fontSize: "var(--text-app-meta)", color: "var(--rim-text-muted)", margin: "24px 0 8px" }}>
              Shown to admins only, to help fix it:
            </p>
            <pre
              style={{
                textAlign: "left",
                fontSize: "var(--text-app-meta)",
                fontFamily: "var(--font-mono)",
                color: "var(--color-error)",
                background: "var(--rim-bg)",
                borderRadius: 8,
                padding: "12px 14px",
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {adminDetail}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

/** "9:00 AM on Sunday, October 19", in Central Time. */
function fmtOpensAt(d: Date): string {
  const time = d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  const day = d.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" });
  return `${time} on ${day}`;
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
 * resolveSessionRole's occurrence matching (the session's Central day): a dated
 * assignment wins over a legacy standing (null-date) one.
 */
async function getDesignatedHostName(
  programSlug: string,
  hubSlug: string,
  sessionDate: Date,
  viewerId: string,
): Promise<string | null> {
  const day = ctDayBounds(sessionDate);
  const rows = await db.hostAssignment.findMany({
    where: {
      programSlug,
      hubSlug,
      userId: { not: null },
      // This session's Central day, as resolveSessionRole matches it
      // (lib/timezone.ts ctDayBounds), or a legacy undated row.
      OR: [{ sessionDate: { gte: day.start, lte: day.end } }, { sessionDate: null }],
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
  teamName,
  roleVerb,
  dayWord,
  showSetup,
  helpHref,
}: {
  programName: string;
  joinUrl: string;
  hostKey: string | null;
  viewerRole: ViewerRole;
  designatedHostName: string | null;
  /** The hosting team's name and -ing verb ("Hosting Team", "hosting"). */
  teamName: string;
  roleVerb: string;
  /** "today", or "on Tue, Oct 20" when entering early for the next session. */
  dayWord: string;
  /** A missing host code is named only to an admin, who can set it. */
  showSetup: boolean;
  /** The tutorial step on claiming host, in this team's words. */
  helpHref: string;
}) {
  const eyebrow =
    viewerRole === "designated"
      ? `You're ${roleVerb} ${dayWord}`
      : viewerRole === "teacher"
        ? `You're teaching ${dayWord}`
        : `You're on the ${teamPhrase(teamName)}`;

  // Who's on it that day (for teacher/alternate).
  const hostLine =
    viewerRole === "designated"
      ? null
      : designatedHostName
        ? `${designatedHostName} is ${roleVerb} ${dayWord}.`
        : `No one is ${roleVerb} ${dayWord} yet.`;

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
          // A host reads the Claim Host steps here before opening Zoom: the
          // app's 16/15px sizes and the bordered surface (2026-10-19: no
          // shell wraps /session, so the public 12/14px sizes showed).
          background: "var(--rim-surface)",
          border: "1px solid var(--rim-rule)",
          borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-app-meta)",
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
          <p style={{ fontSize: "var(--text-app)", color: "var(--rim-mid)", margin: "0 0 20px" }}>
            {hostLine}
          </p>
        )}
        {!hostLine && <div style={{ height: 12 }} />}

        <a
          href={joinUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            boxSizing: "border-box",
            background: "var(--rim-blue)",
            color: "var(--rim-surface)",
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
              fontSize: "var(--text-app)",
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
            {/* Where Claim Host is in Zoom confused hosts (2026-10-21); the
                step opens in a new tab so this code stays in view. */}
            <a
              href={helpHref}
              target="_blank"
              rel="noopener"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                marginTop: 8,
                color: "var(--rim-blue)",
                fontWeight: 600,
              }}
            >
              How to claim host in Zoom →
            </a>
          </div>
        ) : (
          <p style={{ marginTop: 20, fontSize: "var(--text-app)", color: "var(--rim-mid)" }}>
            You&rsquo;ll join under your own name.
            {showSetup && (
              <>
                {" "}(The host code isn&rsquo;t set up. Set <code>ZOOM_HOST_KEY</code> to turn on Claim&nbsp;Host.)
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
