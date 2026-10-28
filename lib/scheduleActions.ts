import "server-only";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SaveActor, SaveReply } from "@/lib/programSave";
import { authorizeSelfClaim, canSelfClaim, ensureActiveHubMembership, getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { canAccessHubScheduler, canManageHubCoverage } from "@/lib/hubAuth";
import {
  sendHostAssignmentConfirmationEmail,
  sendHostAssignmentRemovedEmail,
  sendSubRequestEmail,
  sendSubClaimedEmail,
  sendEachPaced,
  type SubRequestEmailData,
  type SubClaimedEmailData,
} from "@/lib/email";
import { ctDayBounds, ctStartOfToday, fmtSessionDay } from "@/lib/timezone";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramHubSlug,
  getHubCoverageConfig,
  programNeedsHost,
  teamCannotStaff,
} from "@/lib/programHub";
import { recordHubEvent, recordHubEvents } from "@/lib/hubEvents";
import { ctDateStr, isOccurrenceOnDate, shiftToDate } from "@/lib/scheduleUtils";
import { holdRotationDate } from "@/lib/applyStandingAssignments";
import { deliverGapNotices, gapNoticeReachesTeam, prepareGapNotices } from "@/lib/coverageNotices";
import { extractTextAsync } from "@/lib/renderRichContentServer";
import { getHubNotificationRecipients } from "@/lib/toolAuth";

/**
 * The Scheduler's actions (2026-10-28): each route's steps moved here
 * unchanged, so the RIM Guide does exactly what the buttons do
 * (lib/guideSchedule.ts). Each checks its own permissions as before; the
 * routes only check that someone is signed in. Each answers with the status
 * and body its route sends. The routes' own notes stay above their handlers.
 */

const reply = (payload: unknown, init?: { status?: number }): SaveReply => ({
  status: init?.status ?? 200,
  body: payload as Record<string, unknown>,
});

const fmtDate = (d: Date | null) => fmtSessionDay(d);

/** Format a session date for host emails (as sub-claim and standing-assignment emails do). */
function formatSessionDate(date: Date | null): string | null {
  return fmtSessionDay(date);
}

/** Send "you're hosting" to the assignee, in the assignment's team. Runs in after(). */
async function notifyAssignedHost(assignedUserId: string, programSlug: string, sessionDate: Date | null, hubSlug: string): Promise<void> {
  try {
    const [program, assignee] = await Promise.all([
      db.program.findUnique({ where: { slug: programSlug }, select: { name: true } }),
      db.user.findUnique({ where: { id: assignedUserId }, select: { email: true, firstName: true } }),
    ]);
    if (!assignee?.email) return;
    await sendHostAssignmentConfirmationEmail({
      to: assignee.email,
      firstName: assignee.firstName,
      programName: program?.name || programSlug,
      dateText: formatSessionDate(sessionDate),
      sessionAt: sessionDate,
      hubSlug,
    });
  } catch (e) {
    console.error("[host-assignment] confirmation email error:", e);
  }
}

/** The team's record: this person is off this session. */
function recordLeft(
  tx: Prisma.TransactionClient,
  assignment: { hubSlug: string; programSlug: string; sessionDate: Date | null },
  actorId: string,
  removedUserId: string,
) {
  return recordHubEvent(tx, {
    hubSlug: assignment.hubSlug,
    kind: "session-left",
    actorId,
    subjectUserId: removedUserId,
    programSlug: assignment.programSlug,
    sessionDate: assignment.sessionDate,
  });
}

/** POST /api/host/assignments: take a session, or a lead puts someone on one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function placeOnSession(actor: SaveActor, body: any): Promise<SaveReply> {
  const roles = [...actor.roles];
  if (!body?.programSlug) {
    return reply({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, userId, sessionDate, notes, action, hubSlug: bodyHubSlug } = body as {
    programSlug: string;
    userId?: string | null;
    sessionDate?: string | null;
    notes?: string | null;
    action?: "claim";
    /** Hub the assignment lands in. Defaults to the program's primary
     *  hosting hub for backward compat; auxiliary callers (AV /
     *  greeter views) pass their own slug. Session 129. */
    hubSlug?: string | null;
  };

  // Resolve the target hub. Body wins; otherwise fall through to the
  // program's primary hosting hub.
  const programHubSlug = await getProgramHubSlug(programSlug);
  const targetHubSlug = bodyHubSlug || programHubSlug;
  // The body-less fallback to the program's primary hub is backward-compat for
  // legacy callers only (RIM_Hub_Engineering.md). New client code must pass
  // hubSlug; warn loudly so a missing-hubSlug write to the wrong hub is
  // discoverable instead of silent (session 146 fallback hardening).
  if (!bodyHubSlug) {
    console.warn(
      `[assignments] POST without hubSlug — falling back to program primary "${programHubSlug}" for ${programSlug}. New callers must send hubSlug.`,
    );
  }

  // Capability gate routes by the resolved hub. A peer-leader can
  // self-claim a peer-led silent sit; a host-team volunteer can self-claim
  // host-team programs; a greeter signs themselves up in the greeter hub.
  // Manager operations (create-unclaimed, assign-to-others) still require
  // the system-role manager check.
  // Per-hub access gate THEN capability (session 146). Access = member of this
  // hub or an oversight role; capability = ACTIVE + hostingCapability (role
  // fallback only for oversight). A plain HOST can no longer claim in a hub
  // they don't belong to — that was a source of "covers but not a member"
  // orphan assignments.
  if (!(await canAccessHubScheduler(actor.id, roles, targetHubSlug))) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // The team must be one that staffs this program (2026-10-15: this was
  // checked only where the schedule is shown, so a crafted request could add
  // an assignment on any team, for any program or format). Includes "No host
  // needed" on the hosting team.
  const cannot = await teamCannotStaff(targetHubSlug, programSlug);
  if (cannot) return reply({ error: cannot.message }, { status: 422 });

  // Placing yourself is a self-claim, with or without the "claim" action, and
  // passes the one self-claim rule (access, coverage allowed, enrollment).
  // Placing someone else, or leaving a seat empty, is coverage management.
  const placingSelf = action === "claim" || userId === actor.id;
  if (placingSelf) {
    if (!(await authorizeSelfClaim(actor.id, roles, targetHubSlug))) {
      return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
    }
  } else if (!(await canManageHubCoverage(actor.id, roles, targetHubSlug))) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const assignedUserId = placingSelf ? actor.id : (userId ?? null);

  // The session: a day the program meets, stored at the program's own start
  // and matched by its Central day (2026-10-16 audit: the client's timestamp
  // was stored as sent and matched exactly, so any drift split one session
  // into two rows).
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true, name: true, slug: true, programFormat: true, startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
    },
  });
  const requested = sessionDate ? new Date(sessionDate) : null;
  if (!program?.startDatetime || !requested || Number.isNaN(requested.getTime())) {
    return reply({ error: "Which session?" }, { status: 400 });
  }
  const dayStr = ctDateStr(requested.toISOString());
  if (!isOccurrenceOnDate(program, dayStr)) {
    return reply({ error: "This program doesn't meet that day." }, { status: 422 });
  }
  const parsedDate = shiftToDate(program.startDatetime.toISOString(), dayStr);
  const day = ctDayBounds(parsedDate);
  const thisSession = { programSlug, hubSlug: targetHubSlug, sessionDate: { gte: day.start, lte: day.end } };

  // Hub-coverage config decides whether (programSlug, sessionDate, hubSlug)
  // is single-slot or multi-claim. Single-slot (host-team / AV / peer-led):
  // one claimed row per session; the existing "claim the unclaimed seed"
  // pattern stays. Multi-claim (greeter): each sign-up is a fresh insert;
  // dedupe is per (slug, date, hub, userId).
  const hubConfig = await getHubCoverageConfig(targetHubSlug);
  const multiClaim = hubConfig?.allowsMultipleAssignments ?? false;

  if (multiClaim && (action !== "claim" || !assignedUserId)) {
    return reply(
      { error: "This team uses open sign-up, so people sign themselves up." },
      { status: 400 },
    );
  }

  // If assigning a specific person (coordinator/manager path), verify they
  // can host in the target hub BEFORE touching any row. Assigning someone
  // requires them to be an active, hosting-capable MEMBER of this hub, no
  // role fallback (session 146): the server-side guard that keeps a
  // coordinator (or a crafted request) from placing a non-member.
  if (assignedUserId && assignedUserId !== actor.id) {
    if (!(await getEffectiveHostingCapability(assignedUserId, targetHubSlug, false))) {
      return reply(
        { error: "This person can't be scheduled here: they're not on this team, or they're paused or off the schedule." },
        { status: 422 },
      );
    }
  }

  // Check and write under a lock on this session (program, Central day,
  // team), so two people taking the same open seat at once can't both win.
  type Outcome =
    | { kind: "error"; status: number; error: string }
    | { kind: "ok"; row: Awaited<ReturnType<typeof db.hostAssignment.create>> & { user: { id: string; firstName: string | null; lastName: string | null; preferredName: string | null } | null } };
  const userSelect = { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } };
  const outcome: Outcome = await db.$transaction(async (tx) => {
    await tx.$queryRawUnsafe("SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))", `seat:${programSlug}:${dayStr}:${targetHubSlug}`);

    // The team's record (Updates): who now has the session, with the change.
    const ok = async (row: Extract<Outcome, { kind: "ok" }>["row"]): Promise<Outcome> => {
      if (row.userId) {
        await recordHubEvent(tx, {
          hubSlug: targetHubSlug,
          kind: row.userId === actor.id ? "session-taken" : "session-assigned",
          actorId: actor.id,
          subjectUserId: row.userId,
          programSlug,
          sessionDate: parsedDate,
        });
      }
      return { kind: "ok", row };
    };

    if (multiClaim) {
      const dup = await tx.hostAssignment.findFirst({ where: { ...thisSession, userId: assignedUserId }, select: { id: true } });
      if (dup) return { kind: "error", status: 409, error: "You're already signed up." };
      const row = await tx.hostAssignment.create({
        data: { programSlug, hubSlug: targetHubSlug, userId: assignedUserId, sessionDate: parsedDate, notes: notes ?? null, assignedBy: actor.id },
        include: userSelect,
      });
      return ok(row);
    }

    // Single seat: fill an empty row for this session, or refuse if filled.
    const existing = await tx.hostAssignment.findFirst({ where: thisSession, orderBy: { createdAt: "asc" } });
    if (existing) {
      if (existing.userId) {
        return { kind: "error", status: 409, error: existing.userId === actor.id ? "This session is already yours." : "Someone already has this session." };
      }
      if (!assignedUserId) {
        return { kind: "error", status: 409, error: "This session is already on the schedule." };
      }
      const row = await tx.hostAssignment.update({
        where: { id: existing.id },
        data: { userId: assignedUserId, assignedBy: actor.id },
        include: userSelect,
      });
      return ok(row);
    }
    const row = await tx.hostAssignment.create({
      data: { programSlug, hubSlug: targetHubSlug, userId: assignedUserId ?? null, sessionDate: parsedDate, notes: notes ?? null, assignedBy: actor.id },
      include: userSelect,
    });
    return ok(row);
  });
  if (outcome.kind === "error") return reply({ error: outcome.error }, { status: outcome.status });
  const assignment = outcome.row;

  // Confirmation email when someone becomes the host: self-claim AND
  // manager-assigns-to-another-user both flow through here.
  if (assignment.userId) {
    after(() => notifyAssignedHost(assignment.userId!, assignment.programSlug, assignment.sessionDate, assignment.hubSlug));
  }

  return reply({
    id: assignment.id,
    programSlug: assignment.programSlug,
    sessionDate: assignment.sessionDate?.toISOString() ?? null,
    hubSlug: assignment.hubSlug,
    status: assignment.userId ? "claimed" : "unclaimed",
    hostUserId: assignment.userId ?? null,
    hostName: assignment.user
      ? (assignment.user.preferredName ||
          [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

/** PATCH /api/host/assignments/[id]: claim an open slot, or give up / take someone off. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function changeAssignment(actor: SaveActor, id: string, body: any): Promise<SaveReply> {
  const roles = [...actor.roles];
  const action = body?.action as "claim" | "unclaim" | undefined;

  if (!action || !["claim", "unclaim"].includes(action)) {
    return reply({ error: "action must be 'claim' or 'unclaim'" }, { status: 400 });
  }

  const assignment = await db.hostAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return reply({ error: "Not found" }, { status: 404 });
  }

  // Authorize per action AFTER loading the assignment, so the gate can be scoped
  // to the assignment's own hub. (A pre-loaded system-role-only gate here used
  // to shadow the coordinator check below — it 403'd a non-HOST-role hub
  // coordinator on unclaim while DELETE/reassign let them through.)
  if (action === "claim") {
    // Open sign-up teams add a fresh row per person (POST); there is no seat
    // to take. A primary-team seat on a "No host needed" program can't be
    // taken. Both refused before the claim rule, which enrolls on success.
    if ((await getHubCoverageConfig(assignment.hubSlug))?.allowsMultipleAssignments) {
      return reply({ error: "This team uses open sign-up." }, { status: 400 });
    }
    if (
      assignment.hubSlug === (await getProgramHubSlug(assignment.programSlug)) &&
      !(await programNeedsHost(assignment.programSlug))
    ) {
      return reply({ error: 'This program is marked "No host needed".' }, { status: 422 });
    }
    // Claiming an open seat: the same rule as every self-claim, against the
    // assignment's own team. (It checked the retired HOST role, so ordinary
    // volunteers got 403 retaking a session a coordinator had removed.)
    if (assignment.userId) {
      return reply({ error: "This session is already claimed." }, { status: 409 });
    }
    if (!(await authorizeSelfClaim(actor.id, roles, assignment.hubSlug))) {
      return reply({ error: "You can't take sessions on this team's schedule right now." }, { status: 403 });
    }
    // Only if it's still empty: two people claiming at once can't both win,
    // and the second can't overwrite the first (2026-10-16 audit).
    const taken = await db.$transaction(async (tx) => {
      const r = await tx.hostAssignment.updateMany({
        where: { id, userId: null },
        data: { userId: actor.id, assignedBy: actor.id },
      });
      if (r.count) {
        await recordHubEvent(tx, {
          hubSlug: assignment.hubSlug,
          kind: "session-taken",
          actorId: actor.id,
          subjectUserId: actor.id,
          programSlug: assignment.programSlug,
          sessionDate: assignment.sessionDate,
        });
      }
      return r;
    });
    if (taken.count === 0) {
      return reply({ error: "Someone just took this session." }, { status: 409 });
    }
    // Confirmation email to the claimer. The email link is scoped to
    // the assignment's hub (session 129) so an AV claim lands the
    // recipient at /tools/schedule?hub=audio-visual, not host-team.
    after(async () => {
      try {
        const [program, claimer] = await Promise.all([
          db.program.findUnique({
            where: { slug: assignment.programSlug },
            select: { name: true },
          }),
          db.user.findUnique({ where: { id: actor.id }, select: { email: true, firstName: true } }),
        ]);
        if (claimer?.email) {
          await sendHostAssignmentConfirmationEmail({
            to: claimer.email,
            firstName: claimer.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment claim] confirmation email error:", e);
      }
    });
    return reply({ ok: true, status: "claimed" });
  }

  // Open sign-up teams leave by removing the sign-up (DELETE), never by
  // emptying it: an empty row would read as a blank name (2026-10-16 audit).
  if ((await getHubCoverageConfig(assignment.hubSlug))?.allowsMultipleAssignments) {
    return reply({ error: "Cancel the sign-up instead." }, { status: 400 });
  }

  // unclaim — owner removes themselves, OR a manager/hub-coordinator removes
  // anyone in their hub. Coordinator parity with the assign path (session 140):
  // a coordinator who can put someone on a session can take them off it. Scoped
  // to THIS assignment's hub so a coordinator only manages their own team.
  const isOwn = assignment.userId === actor.id;
  const canManage = await canManageHubCoverage(actor.id, roles, assignment.hubSlug);
  if (!canManage && !isOwn) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const removedUserId = assignment.userId;

  // Cancel open sub requests, empty the seat, and hold a rotation date open,
  // together: a half-done release would leave the seat empty and unreported.
  await db.$transaction(async (tx) => {
    await tx.subRequest.updateMany({
      where: { assignmentId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
    await tx.hostAssignment.update({
      where: { id },
      data: { userId: null },
    });
    await holdRotationDate(assignment, actor.id, tx);
    if (removedUserId) await recordLeft(tx, assignment, actor.id, removedUserId);
  });

  // The seat is empty: if the session is within two weeks, the team hears
  // (2026-10-16 ruling), never the person who did it or the person removed.
  // Only when someone was on it: an already-empty seat lost no one.
  const gaps = removedUserId
    ? await prepareGapNotices(
        [{ hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG, programSlug: assignment.programSlug, sessionDate: assignment.sessionDate }],
        [actor.id, removedUserId],
      )
    : [];
  if (gaps.length) after(() => deliverGapNotices(gaps));

  // Courtesy notification: when a coordinator/manager removes SOMEONE ELSE, tell
  // that host — they were emailed when assigned, so a silent removal would leave
  // a stale "you're hosting" note. Self-unclaim is silent (they did it). The
  // template send is pre-threshold-gated, so staged accounts get nothing.
  if (removedUserId && removedUserId !== actor.id) {
    after(async () => {
      try {
        const [program, removed, remover] = await Promise.all([
          db.program.findUnique({ where: { slug: assignment.programSlug }, select: { name: true } }),
          db.user.findUnique({ where: { id: removedUserId }, select: { email: true, firstName: true } }),
          db.user.findUnique({ where: { id: actor.id }, select: { firstName: true, lastName: true, preferredName: true } }),
        ]);
        if (removed?.email) {
          const byName =
            remover?.preferredName ||
            [remover?.firstName, remover?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: removed.email,
            firstName: removed.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment unclaim] removal email error:", e);
      }
    });
  }

  return reply({ ok: true, status: "unclaimed", teamTold: gapNoticeReachesTeam(gaps) });
}

/** DELETE /api/host/assignments/[id]: cancel a sign-up, or a lead removes one. */
export async function deleteAssignment(actor: SaveActor, id: string): Promise<SaveReply> {
  const roles = [...actor.roles];
  const assignment = await db.hostAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return reply({ error: "Not found" }, { status: 404 });
  }
  const canManage = await canManageHubCoverage(actor.id, roles, assignment.hubSlug);
  const isOwn = assignment.userId !== null && assignment.userId === actor.id;

  if (!canManage && !isOwn) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const removedUserId = assignment.userId;

  // Atomic cascade-delete. SubRequest.assignmentId FK is Restrict — a
  // bare hostAssignment.delete would FK-violate the moment any historic
  // SubRequest (CLAIMED, CANCELLED) referenced this row. SubClaim cascades
  // on SubRequest delete but we delete explicitly for clarity. Pattern
  // matches /api/host/assignments/clear (session 130 follow-up — this
  // route had the same FK gap that surfaced as HTTP 500 elsewhere).
  await db.$transaction(async (tx) => {
    await tx.subClaim.deleteMany({
      where: { request: { assignmentId: id } },
    });
    await tx.subRequest.deleteMany({
      where: { assignmentId: id },
    });
    await tx.hostAssignment.delete({ where: { id } });
    await holdRotationDate(assignment, actor.id, tx);
    if (removedUserId) await recordLeft(tx, assignment, actor.id, removedUserId);
  });

  // If that was the session's last person on this team and it's within two
  // weeks, the team hears (2026-10-16: a greeter's cancel was silent).
  const gaps = removedUserId
    ? await prepareGapNotices(
        [{ hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG, programSlug: assignment.programSlug, sessionDate: assignment.sessionDate }],
        [actor.id, removedUserId],
      )
    : [];
  if (gaps.length) after(() => deliverGapNotices(gaps));

  // Courtesy notification, mirroring the PATCH-unclaim path above: when a
  // coordinator/manager removes SOMEONE ELSE, tell that person — they were
  // emailed when they signed up, so a silent removal leaves a stale note.
  // Self-removal (greeter "Cancel my signup") is silent — `removedUserId
  // === self` — which is exactly the distinguisher between the two callers
  // that share this DELETE route. The template is pre-threshold-gated, so
  // staged accounts get nothing.
  if (removedUserId && removedUserId !== actor.id) {
    after(async () => {
      try {
        const [program, removed, remover] = await Promise.all([
          db.program.findUnique({ where: { slug: assignment.programSlug }, select: { name: true } }),
          db.user.findUnique({ where: { id: removedUserId }, select: { email: true, firstName: true } }),
          db.user.findUnique({ where: { id: actor.id }, select: { firstName: true, lastName: true, preferredName: true } }),
        ]);
        if (removed?.email) {
          const byName =
            remover?.preferredName ||
            [remover?.firstName, remover?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: removed.email,
            firstName: removed.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment delete] removal email error:", e);
      }
    });
  }

  return reply({ ok: true, teamTold: gapNoticeReachesTeam(gaps) });
}

/** POST /api/host/assignments/reassign: a lead takes a session over. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function takeOverSession(actor: SaveActor, body: any): Promise<SaveReply> {
  const roles = [...actor.roles];
  if (!body) {
    return reply({ error: "Which session?" }, { status: 400 });
  }

  const { currentAssignmentId } = body as {
    programSlug: string;
    sessionDate?: string | null;
    currentAssignmentId?: string | null;
  };


  let previousUserId: string | null = null;
  // Preserve the existing assignment's hub on reassign (session 129) so
  // an AV reassign doesn't accidentally route the new row to host-team.
  // Falls back to the program's primary hub when there's no existing
  // assignment to inherit from.

  // Load the existing assignment first (if any) so the permission check can be
  // scoped to the SESSION's hub.
  // Taking over is always of a real assignment: its own program, date and
  // team are used, never the request's (2026-10-15 audit).
  if (!currentAssignmentId) {
    return reply({ error: "Which session?" }, { status: 400 });
  }
  const existing = await db.hostAssignment.findUnique({
    where: { id: currentAssignmentId },
  });
  if (!existing) {
    return reply({ error: "Session not found." }, { status: 404 });
  }
  previousUserId = existing.userId ?? null;
  if ((await getHubCoverageConfig(existing.hubSlug))?.allowsMultipleAssignments) {
    return reply({ error: "This team uses open sign-up." }, { status: 400 });
  }

  // Only a session still ahead, on a team that may still staff the program
  // (2026-10-16 audit).
  if (existing.sessionDate && existing.sessionDate < ctStartOfToday()) {
    return reply({ error: "This session has already happened." }, { status: 400 });
  }
  const cannot = await teamCannotStaff(existing.hubSlug, existing.programSlug);
  if (cannot) return reply({ error: cannot.message }, { status: 422 });

  // The assignment's own team decides who may take it over.
  const sessionHubSlug = existing.hubSlug;

  if (!(await canManageHubCoverage(actor.id, roles, sessionHubSlug))) {
    return reply(
      { error: "Only coordinators, Host Managers, and Admins can reassign sessions." },
      { status: 403 },
    );
  }

  if (previousUserId === actor.id) {
    return reply(
      { error: "You're already hosting this session." },
      { status: 409 },
    );
  }

  // Taking it over is placing yourself, so the rule for taking sessions
  // applies too: a coordinator who can't take sessions couldn't claim an empty
  // seat but could take a covered one (2026-10-19 audit).
  if (!(await canSelfClaim(actor.id, roles, sessionHubSlug))) {
    return reply(
      { error: "You aren't set to take sessions on this team." },
      { status: 403 },
    );
  }

  // The person taking over joins the team ("covers ⇒ member").
  await ensureActiveHubMembership(actor.id, existing.hubSlug);

  // Swap in one transaction (FK-safe order: SubClaim → SubRequest →
  // HostAssignment), so a failure never leaves the session with no one.
  const existingId = existing.id;
  const created = await db.$transaction(async (tx) => {
    await tx.subClaim.deleteMany({ where: { request: { assignmentId: existingId } } });
    await tx.subRequest.deleteMany({ where: { assignmentId: existingId } });
    await tx.hostAssignment.delete({ where: { id: existingId } });
    // A rotation-made session taken over by hand stays out of the rotation,
    // or emptying it later would let the rotation put the old person back.
    await holdRotationDate(existing, actor.id, tx);
    // The team's record: who has it now; the person off it, for the leads.
    const where = { hubSlug: existing.hubSlug, programSlug: existing.programSlug, sessionDate: existing.sessionDate };
    await recordHubEvents(tx, [
      ...(previousUserId
        ? [{ ...where, kind: "session-left" as const, actorId: actor.id, subjectUserId: previousUserId }]
        : []),
      { ...where, kind: "session-taken" as const, actorId: actor.id, subjectUserId: actor.id },
    ]);
    return tx.hostAssignment.create({
      data: {
        programSlug: existing.programSlug,
        hubSlug: existing.hubSlug,
        userId: actor.id,
        sessionDate: existing.sessionDate,
        assignedBy: actor.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      },
    });
  });

  // Symmetric host notifications:
  //   - new host (the manager) gets a confirmation email
  //   - previously assigned host, if any, gets a "no longer hosting" email
  // Resolve program name + manager name once, then dispatch both in after().
  const newHostId = actor.id;
  const displacedId = previousUserId;
  after(async () => {
    try {
      const program = await db.program.findUnique({
        where:  { slug: created.programSlug },
        select: { name: true },
      });
      const programName = program?.name || created.programSlug;
      const dateText = fmtDate(created.sessionDate);
      // Use the created row's hub (session 129) so reassigns in AV /
      // peer-led hubs send their links back to the right scheduler view.
      const hubSlug = created.hubSlug;

      const newHost = await db.user.findUnique({
        where:  { id: newHostId },
        select: { email: true, firstName: true, lastName: true, preferredName: true },
      });

      if (newHost?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: newHost.email,
          firstName: newHost.firstName,
          programName,
          dateText,
          sessionAt: created.sessionDate,
          hubSlug,
        });
      }

      if (displacedId && displacedId !== newHostId) {
        const displaced = await db.user.findUnique({
          where:  { id: displacedId },
          select: { email: true, firstName: true },
        });
        if (displaced?.email) {
          const byName =
            newHost?.preferredName ||
            [newHost?.firstName, newHost?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: displaced.email,
            firstName: displaced.firstName,
            programName,
            dateText,
            sessionAt: created.sessionDate,
            byName,
            hubSlug,
          });
        }
      }
    } catch (e) {
      console.error("[host-assignment reassign] notification error:", e);
    }
  });

  return reply({
    id: created.id,
    programSlug: created.programSlug,
    sessionDate: created.sessionDate?.toISOString() ?? null,
    status: "claimed",
    hostUserId: created.userId,
    hostName: created.user
      ? (created.user.preferredName ||
          [created.user.firstName, created.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

/** POST /api/host/sub-requests: ask the team to cover. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function askForCover(actor: SaveActor, body: any): Promise<SaveReply> {
  const roles = [...actor.roles];
  if (!body?.assignmentId) {
    return reply({ error: "assignmentId is required" }, { status: 400 });
  }

  const { assignmentId, message } = body as {
    assignmentId: string;
    message?: unknown;
  };

  // Verify assignment belongs to this user (or is HOST_MANAGER/ADMIN)
  const assignment = await db.hostAssignment.findUnique({
    where: { id: assignmentId },
    include: { user: { select: { id: true, firstName: true, email: true } } },
  });
  if (!assignment) {
    return reply({ error: "Assignment not found" }, { status: 404 });
  }

  // Resolve the assignment's hub (session 129). The capability gate and
  // the notification recipient pool both route by the assignment's own
  // hub — an AV sub-request notifies AV teammates, not host-team. Fall
  // back to the program's primary hub for legacy rows whose hubSlug
  // somehow didn't get backfilled.
  const assignmentHubSlug =
    assignment.hubSlug || (await getProgramHubSlug(assignment.programSlug));

  // Sub-requests don't apply to multi-claim hubs (greeter — open
  // sign-up). The user just cancels their own signup directly.
  const hub = await db.hub.findUnique({
    where: { slug: assignmentHubSlug },
    select: { allowsMultipleAssignments: true },
  });
  if (hub?.allowsMultipleAssignments) {
    return reply(
      { error: "This team uses open sign-up. Cancel your sign-up instead of asking for cover." },
      { status: 400 },
    );
  }
  // Owner, a manager, OR a coordinator of the assignment's hub can open a cover
  // request. Coordinator parity with assign / remove / reassign / clear (session
  // 142 completed the coordinator-as-manager-for-their-own-hub model — this was
  // the one remaining manager-or-own-only coverage action). Scoped to THIS
  // assignment's hub, so a coordinator only acts on their own team; a plain host
  // still acts only on their own assignment. (Greeter/multi-claim hubs are
  // already rejected above — open sign-up has no sub-request flow.)
  // The person whose session it is may always ask (even while paused: they're
  // stepping back); managers and the team's coordinator may ask for them.
  const canManage = await canManageHubCoverage(actor.id, roles, assignmentHubSlug);
  if (!canManage && assignment.userId !== actor.id) {
    return reply({ error: "You can only request subs for your own assignments" }, { status: 403 });
  }

  // The request's date is the assignment's own (2026-10-15: the browser never
  // sent one, so every request was undated in emails and Updates).
  const sessionDate = assignment.sessionDate;

  // One open request per assignment (older requests were saved undated).
  const existing = await db.subRequest.findFirst({
    where: { assignmentId, status: "OPEN" },
  });
  if (existing) {
    return reply(
      { error: "An open sub request already exists for this session." },
      { status: 409 }
    );
  }

  const subRequest = await db.subRequest.create({
    data: {
      assignmentId,
      programSlug: assignment.programSlug,
      sessionDate,
      // Whose session it is (a coordinator may ask on their behalf).
      requestedById: assignment.userId ?? actor.id,
      message: message ?? Prisma.JsonNull,
    },
  });

  const requesterName = assignment.user
    ? [assignment.user.firstName].filter(Boolean).join(" ") || assignment.user.email
    : "Someone";
  const sessionLabel = fmtSessionDay(sessionDate);

  // Send emails after the response. `after()` keeps the work alive past
  // reply() — without it, Vercel tears the function down and the
  // in-flight Resend calls get killed (the symptom: emails arrive
  // intermittently, or not at all).
  after(async () => {
    try {
      // Resolve the human-readable program name (slugs look ugly in email
      // bodies — "Jesse needs a sub for good-evening-silent-meditation"
      // versus "Jesse needs a sub for Good Evening Silent Meditation").
      // Per CLAUDE.md: resolve Program.name from the slug before sending
      // any host email.
      const [recipientUsers, program] = await Promise.all([
        getHubNotificationRecipients(assignmentHubSlug, {
          excludeUserId: assignment.userId ?? undefined,
          canCover: true,
          withMuted: true,
        }),
        db.program.findUnique({
          where: { slug: assignment.programSlug },
          select: { name: true },
        }),
      ]);
      const programName = program?.name || assignment.programSlug;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageText = message ? (await extractTextAsync(message as any) || null) : null;
      // Not to the coordinator who asked on someone's behalf, either.
      const others = recipientUsers.filter((u) => u.id !== actor.id);
      await sendEachPaced(others, (u) =>
        sendSubRequestEmail({
          to: u.email,
          firstName: u.firstName,
          requesterName,
          programName,
          sessionDate: sessionLabel,
          message: messageText,
          subRequestId: subRequest.id,
          sessionAt: sessionDate,
          hubSlug: assignmentHubSlug,
          // Team emails off: Notifications only (2026-10-20).
          noticeOnly: u.muted,
        } as SubRequestEmailData),
        "sub-request-posted",
      );
    } catch (e) {
      console.error("[sub-requests] notification error:", e);
    }
  });

  return reply({ id: subRequest.id, ok: true });
}

/** PATCH /api/host/sub-requests/[id]: clear a cover request. */
export async function cancelCoverRequest(actor: SaveActor, id: string): Promise<SaveReply> {
  const roles = [...actor.roles];
  const subRequest = await db.subRequest.findUnique({
    where: { id },
    include: { assignment: { select: { userId: true, hubSlug: true } } },
  });
  if (!subRequest) {
    return reply({ error: "Not found" }, { status: 404 });
  }
  if (subRequest.status !== "OPEN") {
    return reply({ error: "Only open requests can be cancelled" }, { status: 409 });
  }
  const isOwn = subRequest.assignment.userId === actor.id;
  const canManage = await canManageHubCoverage(actor.id, roles, subRequest.assignment.hubSlug);
  if (!canManage && !isOwn) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // Only while still open: a cover that landed first stands (2026-10-16 audit).
  const closed = await db.subRequest.updateMany({ where: { id, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (closed.count === 0) {
    return reply({ error: "This request is already closed: someone covered it, or it was cancelled." }, { status: 409 });
  }
  return reply({ ok: true });
}

/** POST /api/host/sub-requests/[id]/claim: cover someone's request. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function coverRequest(actor: SaveActor, id: string, body: any): Promise<SaveReply> {
  const roles = [...actor.roles];
  const { message } = body as { message?: string };

  const subRequest = await db.subRequest.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  });

  if (!subRequest) {
    return reply({ error: "Not found" }, { status: 404 });
  }
  if (subRequest.status !== "OPEN") {
    return reply({ error: "This request is no longer open" }, { status: 409 });
  }
  // Can't claim your own request
  if (subRequest.assignment.userId === actor.id) {
    return reply({ error: "You cannot claim your own sub request" }, { status: 409 });
  }

  // Capability gate, scoped to the assignment's hub (session 129) so an
  // AV sub-request claim is gated against the AV team — not host-team.
  const assignmentHubSlug =
    subRequest.assignment.hubSlug || (await getProgramHubSlug(subRequest.programSlug));
  // The same rule as every self-claim (lib/hubMemberAuth.ts): a member or an
  // oversight role, hosting allowed, enrolled on the team ("covers ⇒ member").
  // It used a role fallback that let a non-member cover and stay off the roster.
  if (!(await authorizeSelfClaim(actor.id, roles, assignmentHubSlug))) {
    return reply({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // Fetch claimer's name for notifications
  const claimer = await db.user.findUnique({
    where: { id: actor.id },
    select: { firstName: true, lastName: true, email: true },
  });
  const claimerName =
    [claimer?.firstName, claimer?.lastName].filter(Boolean).join(" ") ||
    claimer?.email ||
    "Someone";

  // Claim, close the request and move the seat, atomically. The request
  // closes only if it is still open, so two people covering at once can't
  // both win, and a cancel that landed first is respected (2026-10-16 audit).
  const won = await db.$transaction(async (tx) => {
    const closed = await tx.subRequest.updateMany({ where: { id, status: "OPEN" }, data: { status: "CLAIMED" } });
    if (closed.count === 0) return false;
    await tx.subClaim.create({
      data: { requestId: id, claimedById: actor.id, message: message ?? Prisma.JsonNull },
    });
    await tx.hostAssignment.update({ where: { id: subRequest.assignmentId }, data: { userId: actor.id } });
    return true;
  });
  if (!won) {
    return reply({ error: "Someone has already covered this session, or the request was closed." }, { status: 409 });
  }

  // The request's own date, else its assignment's (older requests were saved
  // undated), in Central Time (2026-10-15).
  const sessionAt = subRequest.sessionDate ?? subRequest.assignment.sessionDate;
  const sessionLabel = fmtSessionDay(sessionAt);

  // Resolve human-friendly program name (slug isn't great in an email body)
  // and the claimer's email + first name for their own confirmation.
  const [program, claimerForEmail] = await Promise.all([
    db.program.findUnique({
      where:  { slug: subRequest.programSlug },
      select: { name: true },
    }),
    db.user.findUnique({
      where:  { id: actor.id },
      select: { email: true, firstName: true },
    }),
  ]);
  const programName = program?.name || subRequest.programSlug;
  // Two notes, each to the other person (2026-10-16 audit: the claimer's own
  // note was quoted back to them, and the request's note never reached them).
  const claimerNote = message ? (await extractTextAsync(message) || null) : null;
  const requestNote = subRequest.message ? (await extractTextAsync(subRequest.message) || null) : null;

  // Send both emails after the response. The requester gets the existing
  // "your session is covered" email; the claimer gets a confirmation so they
  // have it in their inbox alongside their other host scheduling messages.
  after(async () => {
    try {
      const requester = subRequest.assignment.user;
      if (requester) {
        await sendSubClaimedEmail({
          to: requester.email,
          firstName: requester.firstName,
          claimerName,
          programName,
          sessionDate: sessionLabel,
          message: claimerNote,
          hubSlug: assignmentHubSlug,
          sessionAt,
        } as SubClaimedEmailData);
      }

      if (claimerForEmail?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: claimerForEmail.email,
          firstName: claimerForEmail.firstName,
          programName,
          dateText: sessionLabel,
          requesterNote: requestNote,
          sessionAt,
          hubSlug: assignmentHubSlug,
        });
      }
    } catch (e) {
      console.error("[sub-claim] notification error:", e);
    }
  });

  return reply({ ok: true });
}
