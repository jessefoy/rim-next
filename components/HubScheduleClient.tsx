"use client";

/**
 * Host schedule — team agenda view with filters.
 *
 * Architecture:
 * - Default view shows the team's full upcoming schedule (collective awareness first).
 * - Filter pills narrow to: All / Needs help / Mine / My requests.
 * - Agenda rows grouped by week (this week, next week, week of X).
 * - One unified row design for every state — color accent + status text differs.
 * - Responsive: 4-column grid on desktop, stacked on phone.
 * - Email deep links: ?action=take|cover|cancel&id=… opens the matching modal.
 * - Cancel cover request: if I asked for help and changed my mind, undo it.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";
import { EARLY_OPEN_MIN, LATE_GRACE_MIN, FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 60 }} /> },
);

const RotationsClient = dynamic(
  () => import("@/components/RotationsClient"),
  { ssr: false, loading: () => <p className="hs-loading">Loading rotations…</p> },
);

/** One signed-up volunteer on a multi-claim session (greeter hub). */
interface Claimant {
  assignmentId: string;
  userId: string | null;
  userName: string | null;
  badge: "paused" | "inactive" | null;
}

interface Session {
  id: string;
  programId: string | null;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  /** Occurrence end (ISO), or null when the program has no endDatetime. With
   *  sessionDate (start) this lets HsRow show "Enter room" only while the
   *  session is actually enterable (mirrors lib/sessionWindow.ts). */
  sessionEnd?: string | null;
  status: "unclaimed" | "claimed" | "sub_needed";
  hostUserId: string | null;
  hostName: string | null;
  /** Populated only in multi-claim hubs (greeter). Empty in single-slot
   *  hubs (host-team, AV, peer-led). When non-empty the row renders as
   *  a sign-up stack instead of one-host-with-actions. */
  claimants?: Claimant[];
  subRequestId: string | null;
  subMessage: any;
  programFormat: string | null;
  livekitRoom?: string | null;
  /** ISO timestamp when the program was created. Drives the NEW badge. */
  programCreatedAt?: string | null;
  /** If non-null, this assignment was created by a standing rotation rule. */
  standingAssignmentId?: string | null;
  /**
   * Coordinator-facing status for the assigned host.
   * "paused" — HubMember.status is PAUSED or hostingCapability is false while ACTIVE.
   * "inactive" — HubMember.status is INACTIVE (host has left the team but assignment
   *              was not released; coordinator should act).
   * null — host is fully active, or no host assigned.
   */
  hostBadge?: "paused" | "inactive" | null;
}

/** A standing rotation the current user is on — drives the host-side summary. */
interface MyRotation {
  id:          string;
  programSlug: string;
  programName: string;
  occurrence:  "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "FIFTH" | "LAST" | "ALL";
  dayOfWeek:   string | null;
  endsOn:      string | null;
}

/** Programs created within this many days show a NEW badge on schedule cards. */
const NEW_PROGRAM_DAYS = 14;

interface Program {
  id: string | null;
  slug: string;
  name: string;
  programFormat: string | null;
  /** Days of week this program runs on (e.g. ["MO","TH"]). Drives rotation editor rows. */
  recurrenceDays: string[];
}

interface TeamMember {
  id: string;
  displayName: string;
  isCoordinator: boolean;
}

interface Props {
  initialSessions: Session[];
  programs: Program[];
  teamMembers: TeamMember[];
  initialYear: number;
  initialMonth: number;
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string;
  isHostManager?: boolean;
  /** HOST_MANAGER / ADMIN / hub coordinator — rotation clear/reset controls. */
  isManager?: boolean;
  /** The current user's active standing rotations (host-side summary only). */
  myRotations?: MyRotation[];
  /** Next upcoming HostAssignment ISO datetime per programSlug — drives the "Next" column. */
  nextSessionBySlug?: Record<string, string>;
  apiBase?: string;
  /** Active hub slug — drives the hub-scoped rotation list lookup. Slice 2.6. */
  hubSlug?: string;
  /** When true, the hub is multi-claimant (greeter): one session card
   *  lists every signed-up volunteer and the action is "Sign up" /
   *  "Cancel my signup" instead of "claim/cover". Session 129. */
  allowsMultipleAssignments?: boolean;
  /** Role-aware copy for the active hub (session 130 follow-up). Drives
   *  user-facing strings: "{Noun} needed" / "You're {verb}" / "Yes, I
   *  can {action}" — so the AV hub reads "AV needed" / "You're covering
   *  AV" / "Yes, I can cover AV" instead of the host-team default.
   *  Defaults to host-team values if absent. */
  coverageCopy?: { noun: string; verb: string; action: string };
}

const TZ = "America/Chicago";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FilterKey = "all" | "needs" | "mine" | "my-requests";
type RowKind = "needs-host" | "needs-sub" | "mine" | "mine-asking" | "covered" | "multi";

// ── Formatters ──────────────────────────────────────────────

function fmtDateLong(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: TZ,
  });
}
function fmtDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: TZ,
  });
}
function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  });
}
function fmtFormat(fmt: string | null): string {
  if (fmt === "virtual") return "Virtual";
  if (fmt === "hybrid") return "In-person and virtual";
  if (fmt === "in-person") return "In person";
  return "";
}

// ── Time helpers ────────────────────────────────────────────

function getCtNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function getTodayStart(): Date {
  const ct = getCtNow();
  ct.setHours(0, 0, 0, 0);
  return ct;
}
function getWeekStart(date: Date): Date {
  const ct = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const dow = ct.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  ct.setDate(ct.getDate() + diff);
  ct.setHours(0, 0, 0, 0);
  return ct;
}
function getWeekLabel(weekStart: Date, todayWeekStart: Date, isCurrentMonth: boolean): string {
  // Relative labels only when the user is in their "now" frame (current month).
  // For any other month, use absolute date labels — relative labels are
  // misleading once you've navigated away from today.
  if (isCurrentMonth) {
    const diffDays = Math.round((weekStart.getTime() - todayWeekStart.getTime()) / 86400000);
    if (diffDays === 0) return "This week";
    if (diffDays === 7) return "Next week";
    if (diffDays === -7) return "Last week";
  }
  return `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function rowKind(s: Session, currentUserId: string): RowKind {
  // Multi-claim sessions (greeter) carry a `claimants` array and don't
  // use the single-host/sub-request shape at all. They always render
  // through the dedicated multi-claim row variant. Session 129.
  if (s.claimants && s.claimants.length > 0 || (s.id.startsWith("multi::"))) {
    return "multi";
  }
  if (s.hostUserId === currentUserId) {
    return s.subRequestId ? "mine-asking" : "mine";
  }
  if (s.status === "sub_needed") return "needs-sub";
  if (s.status === "unclaimed" || !s.hostUserId) return "needs-host";
  return "covered";
}

/**
 * Does this session "belong to" a user? True if they're its single-slot host
 * OR (in a multi-claim hub like greeter) one of its claimants. The per-member
 * view ("Mine" / pick a teammate) and its count must use this — keying off
 * hostUserId alone misses every greeter sign-up, because multi-claim rows carry
 * claimants[] and leave hostUserId null (session 146 follow-up: "click a member
 * and it shows nothing they're greeting").
 */
function sessionBelongsTo(s: Session, userId: string): boolean {
  if (s.hostUserId === userId) return true;
  return (s.claimants ?? []).some((c) => c.userId === userId);
}

interface Bucket {
  weekStartMs: number;
  label: string;
  sessions: Session[];
}

function bucketByWeek(sessions: Session[], isCurrentMonth: boolean): Bucket[] {
  const todayWS = getWeekStart(new Date());
  const map = new Map<number, Session[]>();
  for (const s of sessions) {
    if (!s.sessionDate) continue;
    const ws = getWeekStart(new Date(s.sessionDate)).getTime();
    if (!map.has(ws)) map.set(ws, []);
    map.get(ws)!.push(s);
  }
  const sortByDate = (a: Session, b: Session) => {
    if (!a.sessionDate) return 1;
    if (!b.sessionDate) return -1;
    return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
  };
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ws, list]) => ({
      weekStartMs: ws,
      label: getWeekLabel(new Date(ws), todayWS, isCurrentMonth),
      sessions: list.slice().sort(sortByDate),
    }));
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Modal ───────────────────────────────────────────────────

type ModalKind = "take" | "cover" | "ask-cover" | "ask-cover-for" | "cancel-request" | "clear-request" | "reassign" | "unassign" | null;

interface ModalProps {
  kind: ModalKind;
  session: Session | null;
  onConfirm: (extra?: any) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

function HsModal({ kind, session, onConfirm, onCancel, submitting }: ModalProps) {
  const [coverNote, setCoverNote] = useState<string>("");

  useEffect(() => {
    if (kind === "ask-cover" || kind === "ask-cover-for") setCoverNote("");
  }, [kind, session?.id]);

  if (!kind || !session) return null;

  const dateStr = fmtDateLong(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);

  let title = "";
  let body: React.ReactNode = "";
  let primaryLabel = "";
  let extraInput: React.ReactNode = null;
  let cancelLabel = "Not yet";

  if (kind === "take") {
    title = "Confirm hosting";
    body = (
      <>You'll host <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong> at <strong>{timeStr}</strong>. The team
      will be notified.</>
    );
    primaryLabel = "Yes, I'll host this";
  } else if (kind === "cover") {
    title = "Confirm covering";
    body = (
      <>You'll cover for <strong>{session.hostName ?? "the original host"}</strong>{" "}
      on <strong>{dateStr}</strong> for <strong>{session.programName}</strong>.
      They'll be notified that you're stepping in.</>
    );
    primaryLabel = "Yes, I'll cover this";
  } else if (kind === "ask-cover") {
    title = "Ask the team to cover";
    body = (
      <>Let your teammates know you can't make <strong>{dateStr}</strong> for{" "}
      <strong>{session.programName}</strong>. They'll receive an email and
      someone may step in.</>
    );
    primaryLabel = "Send to the team";
    extraInput = (
      <div className="hs-modal__field">
        <label className="hs-modal__field-label">Add a note (optional)</label>
        <RimTiptapEditor
          value={coverNote}
          onChange={setCoverNote}
          placeholder="Anything the replacement should know…"
          variant="message"
        />
      </div>
    );
  } else if (kind === "ask-cover-for") {
    // Coordinator opens a cover request on a host's behalf (covered row).
    // Copy names the host so it never reads as "your session" — the
    // backlog's specific concern about this affordance reading oddly.
    title = "Ask the team to cover";
    body = (
      <>Ask the team to cover for <strong>{session.hostName ?? "the host"}</strong>{" "}
      on <strong>{dateStr}</strong> for <strong>{session.programName}</strong>.
      The team will receive an email and someone may step in.{" "}
      <strong>{session.hostName ?? "The host"}</strong> stays assigned until
      someone does.</>
    );
    primaryLabel = "Send to the team";
    extraInput = (
      <div className="hs-modal__field">
        <label className="hs-modal__field-label">Add a note (optional)</label>
        <RimTiptapEditor
          value={coverNote}
          onChange={setCoverNote}
          placeholder="Anything the replacement should know…"
          variant="message"
        />
      </div>
    );
  } else if (kind === "cancel-request") {
    title = "Cancel your request?";
    body = (
      <>You'll go back to hosting <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong> yourself. The team will know your request
      is closed.</>
    );
    primaryLabel = "Yes, cancel the request";
    cancelLabel = "Keep the request";
  } else if (kind === "clear-request") {
    title = "Clear this cover request?";
    body = (
      <>This closes the cover request for <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong>. <strong>{session.hostName ?? "The host"}</strong>{" "}
      stays on as host.</>
    );
    primaryLabel = "Yes, clear the request";
    cancelLabel = "Keep the request";
  } else if (kind === "reassign") {
    title = "Reassign to yourself";
    body = session.hostUserId
      ? (
        <>This will remove <strong>{session.hostName ?? "the current host"}</strong>{" "}
        from <strong>{session.programName}</strong> on <strong>{dateStr}</strong>{" "}
        and assign you. They will be notified. Any open cover request will be closed.</>
      )
      : (
        <>This will assign you to <strong>{session.programName}</strong> on{" "}
        <strong>{dateStr}</strong>.</>
      );
    primaryLabel = "Yes, reassign to me";
  } else if (kind === "unassign") {
    title = "Remove this host?";
    body = (
      <>This takes <strong>{session.hostName ?? "the current host"}</strong> off{" "}
      <strong>{session.programName}</strong> on <strong>{dateStr}</strong>. The
      session reopens as needing coverage, and they&apos;ll be notified. Any open
      cover request will be closed.</>
    );
    primaryLabel = "Yes, remove";
    cancelLabel = "Keep them on";
  }

  return (
    <div className="hs-modal-backdrop" onClick={onCancel}>
      <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="hs-modal__title">{title}</h2>
        <div className="hs-modal__body">{body}</div>
        {extraInput}
        <div className="hs-modal__actions">
          <button
            className="lr-btn lr-btn--host hs-modal__primary"
            onClick={() => onConfirm(kind === "ask-cover" || kind === "ask-cover-for" ? coverNote : undefined)}
            disabled={submitting}
          >
            {submitting ? "Working…" : primaryLabel}
          </button>
          <button
            className="hs-modal__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agenda row ──────────────────────────────────────────────

interface RowProps {
  session: Session;
  kind: RowKind;
  isPast: boolean;
  currentUserId: string;
  onTake: (s: Session) => void;
  onCover: (s: Session) => void;
  onAskCover: (s: Session) => void;
  /** Coordinator/manager: ask the team to cover on a host's behalf (covered row). */
  onAskCoverFor: (s: Session) => void;
  onCancelRequest: (s: Session) => void;
  /** Coordinator/manager: clear someone else's open cover request (host stays). */
  onClearRequest: (s: Session) => void;
  onReassign: (s: Session) => void;
  /** Coordinator/manager: take the current host off a covered session. */
  onUnassign: (s: Session) => void;
  /** Multi-claim hubs only: sign me up for this session. */
  onSignUp?: (s: Session) => void;
  /** Multi-claim hubs only: cancel my signup on this session. */
  onCancelSignUp?: (s: Session, assignmentId: string) => void;
  /** Multi-claim hubs only: coordinator/manager removes another person's signup. */
  onRemoveSignup?: (s: Session, assignmentId: string, userName: string | null) => void;
  isHostManager: boolean;
  /** Role-aware copy for the active hub (session 130 follow-up). */
  coverageCopy: { noun: string; verb: string; action: string };
  /** Coordinator/manager (incl. hub coordinators) — shows the assign-in-place
   *  affordance on needs-coverage rows (session 140). */
  isManager: boolean;
  teamMembers: { id: string; displayName: string; isCoordinator: boolean }[];
  onAssign: (s: Session, userId: string) => Promise<void>;
  /** Multi-claim hub (greeter): open sign-up model. Suppresses single-slot
   *  affordances that don't apply (the assign-others picker on empty rows). */
  allowsMultipleAssignments?: boolean;
}

/**
 * Coordinator affordance on a needs-coverage row: assign a chosen teammate
 * to this gap in place (session 140, Phase 2 slice 1 of the coordinator view).
 * A native <select> is the mobile-right control — the OS picker, nothing
 * custom to fight touch. Collapsed behind a quiet link by default so gap rows
 * stay scannable; the coordinator's primary job is *seeing* the gaps.
 */
function AssignControl({
  session, teamMembers, onAssign,
}: {
  session: Session;
  teamMembers: { id: string; displayName: string; isCoordinator: boolean }[];
  onAssign: (s: Session, userId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="hs-row__assign-link" onClick={() => setOpen(true)}>
        Assign someone…
      </button>
    );
  }
  return (
    <select
      className="hs-row__assign-select"
      defaultValue=""
      disabled={busy}
      onChange={async (e) => {
        const uid = e.target.value;
        if (!uid) { setOpen(false); return; }
        setBusy(true);
        await onAssign(session, uid);
        // On success the row re-renders as "covered" and this control
        // unmounts; on failure it stays a gap, so collapse back to the link.
        setBusy(false);
        setOpen(false);
      }}
    >
      <option value="">{busy ? "Assigning…" : "Choose a person…"}</option>
      {teamMembers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}{m.isCoordinator ? " ★" : ""}
        </option>
      ))}
    </select>
  );
}

function HsRow({
  session, kind, isPast, currentUserId,
  onTake, onCover, onAskCover, onAskCoverFor, onCancelRequest, onClearRequest, onReassign, onUnassign,
  onSignUp, onCancelSignUp, onRemoveSignup,
  isHostManager,
  coverageCopy,
  isManager, teamMembers, onAssign, allowsMultipleAssignments,
}: RowProps) {
  const dateShort = fmtDateShort(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);
  const fmt = fmtFormat(session.programFormat);

  // Only surface "Enter room →" while the session is actually enterable — i.e.
  // now is inside the LiveKit join window for THIS occurrence. The session page
  // passes no date and the server only ever opens *today's* session, so a link
  // on a future/non-live row can only dead-end with "No session right now"
  // (Maria's session-140 #2 report). Timing comes from the shared
  // lib/sessionWindowConstants (same numbers the server gate uses): opens
  // EARLY_OPEN_MIN before start, closes LATE_GRACE_MIN after end (or
  // FALLBACK_DURATION_MIN past start when the program has no endDatetime).
  // Evaluated at render — matches the NEW badge.
  const isRoomLiveNow = (() => {
    if (isPast) return false;
    if (session.programFormat !== "virtual" && session.programFormat !== "hybrid") return false;
    if (!session.sessionDate) return false;
    const start = new Date(session.sessionDate).getTime();
    if (Number.isNaN(start)) return false;
    const endRaw = session.sessionEnd ? new Date(session.sessionEnd).getTime() : NaN;
    const end = Number.isNaN(endRaw) ? start + FALLBACK_DURATION_MIN * 60_000 : endRaw;
    const opensAt = start - EARLY_OPEN_MIN * 60_000;
    const closesAt = end + LATE_GRACE_MIN * 60_000;
    const now = Date.now();
    return now >= opensAt && now <= closesAt;
  })();

  // Reassign + Remove are coverage-management actions on covered rows. Gated by
  // isManager (managers AND coordinators of the active hub), not isHostManager —
  // a coordinator who can assign a host can also reassign/remove one (the gap
  // Nancy hit: she could put Maria on a session but had no way to take her off).
  const showCoverageManage = isManager && kind === "covered" && !isPast;

  let statusEl: React.ReactNode = null;
  let actionEl: React.ReactNode = null;

  // Lowercase form of the role noun for natural inline use ("No host (missed)"
  // / "Needs a host" reads with lowercase). Capitalize-on-use for statuses.
  const nounLower = coverageCopy.noun.toLowerCase() === "av"
    ? "AV" // AV stays uppercase regardless
    : coverageCopy.noun.toLowerCase();
  const nounCap   = coverageCopy.noun;

  switch (kind) {
    case "needs-host":
      statusEl = <span className="hs-row__status hs-row__status--needs">{isPast ? `No ${nounLower} (missed)` : `${nounCap} needed`}</span>;
      if (!isPast) {
        actionEl = (
          <div className="hs-row__action-stack">
            <button className="lr-btn lr-btn--host" onClick={() => onTake(session)}>
              Yes, I can {coverageCopy.action}
            </button>
            {/* Assign-a-specific-person is a single-slot operation. Multi-claim
                hubs (greeter) use open sign-up — the server rejects assign-others
                there — so the picker is hidden on those empty rows. */}
            {isManager && !allowsMultipleAssignments && (
              <AssignControl session={session} teamMembers={teamMembers} onAssign={onAssign} />
            )}
          </div>
        );
      }
      break;
    case "needs-sub":
      statusEl = (
        <span className="hs-row__status hs-row__status--needs">
          {isPast
            ? "Sub never claimed"
            : (session.hostName ? `${session.hostName} needs help` : "Needs a sub")}
        </span>
      );
      if (!isPast) {
        actionEl = (
          <div className="hs-row__action-stack">
            <button className="lr-btn lr-btn--host" onClick={() => onCover(session)}>
              Yes, I can cover
            </button>
            {/* Coordinator/manager: clear the cover request without removing the
                host (the host stays on). Gated by isManager — the requesting
                host themselves sees "Cancel my request" on their own row. */}
            {isManager && (
              <button className="hs-row__quiet" onClick={() => onClearRequest(session)}>
                Clear request
              </button>
            )}
          </div>
        );
      }
      break;
    case "mine":
      statusEl = <span className="hs-row__status hs-row__status--mine">You&apos;re {coverageCopy.verb}</span>;
      if (!isPast) {
        actionEl = (
          <button className="hs-row__quiet" onClick={() => onAskCover(session)}>
            Ask the team to cover
          </button>
        );
      }
      break;
    case "mine-asking":
      statusEl = <span className="hs-row__status hs-row__status--asking">You asked for cover</span>;
      if (!isPast) {
        actionEl = (
          <button className="hs-row__quiet" onClick={() => onCancelRequest(session)}>
            Cancel my request
          </button>
        );
      }
      break;
    case "covered":
      statusEl = (
        <span className="hs-row__status hs-row__status--covered">
          {nounCap}: {session.hostName ?? "—"}
          {session.hostBadge && (
            <span className="hs-row__paused-badge">
              {session.hostBadge === "inactive" ? "inactive" : "paused"}
            </span>
          )}
        </span>
      );
      break;
    case "multi": {
      // Multi-claim hubs (greeter): the row reads as a community of
      // signed-up people, not a CSV. Plain-language state sentence,
      // names stacked vertically, "you" mark on the signed-in user's
      // row, and one dominant action that reads as invitation when no
      // one's signed up. Open sign-up — no sub-request flow.
      const claimants = session.claimants ?? [];
      const count = claimants.length;
      const mine = claimants.find((c) => c.userId === currentUserId);

      let headerText: string;
      if (count === 0) {
        headerText = isPast ? "No one signed up" : "No one yet — be the first?";
      } else if (count === 1) {
        headerText = mine ? "You're signed up" : "1 person signed up";
      } else {
        headerText = mine
          ? `${count} signed up · you're one of them`
          : `${count} signed up`;
      }

      statusEl = (
        <div className="hs-row__multi">
          <div
            className={
              "hs-row__multi-header" +
              (count === 0 ? " hs-row__multi-header--empty" : "")
            }
          >
            {headerText}
          </div>
          {count > 0 && (
            <ul className="hs-row__multi-list">
              {claimants.map((c) => {
                const isMe = c.userId === currentUserId;
                return (
                  <li
                    key={c.assignmentId}
                    className={
                      "hs-row__multi-item" + (isMe ? " hs-row__multi-item--mine" : "")
                    }
                  >
                    <span className="hs-row__multi-name">{c.userName ?? "—"}</span>
                    {isMe && <span className="hs-row__multi-you">you</span>}
                    {c.badge && (
                      <span className="hs-row__paused-badge">
                        {c.badge === "inactive" ? "inactive" : "paused"}
                      </span>
                    )}
                    {/* Coordinator/manager: remove another person's signup
                        (the signed-in user uses "Cancel my signup" below). */}
                    {isManager && !isMe && !isPast && c.userId && (
                      <button
                        className="hs-row__multi-remove"
                        onClick={() => onRemoveSignup?.(session, c.assignmentId, c.userName)}
                        aria-label={`Remove ${c.userName ?? "this person"}'s signup`}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );

      if (!isPast) {
        actionEl = mine
          ? (
            <button
              className="hs-row__quiet"
              onClick={() => onCancelSignUp?.(session, mine.assignmentId)}
            >
              Cancel my signup
            </button>
          )
          : (
            <button className="lr-btn lr-btn--host" onClick={() => onSignUp?.(session)}>
              {count === 0 ? "I’ll be the first" : "I’ll be there too"}
            </button>
          );
      }
      break;
    }
  }

  // "NEW" badge: program was created within the last NEW_PROGRAM_DAYS.
  // Helps the coordinator (and hosts) notice new offerings that may need
  // attention or volunteers without scrolling through filters. Disappears
  // automatically — no manual dismissal needed.
  const isNewProgram = (() => {
    if (!session.programCreatedAt) return false;
    const ms = new Date(session.programCreatedAt).getTime();
    if (Number.isNaN(ms)) return false;
    return Date.now() - ms < NEW_PROGRAM_DAYS * 24 * 60 * 60 * 1000;
  })();

  return (
    <div className={`hs-row hs-row--${kind}${isPast ? " hs-row--past" : ""}`}>
      <div className="hs-row__when">
        <div className="hs-row__date">{dateShort}</div>
        <div className="hs-row__time">{timeStr}</div>
      </div>
      <div className="hs-row__what">
        <div className="hs-row__name">
          {session.programName}
          {isNewProgram && !isPast && <span className="hs-row__new-badge" aria-label="New program">NEW</span>}
          {session.standingAssignmentId && (
            <span className="hs-row__via" aria-label="Assigned via standing rotation">via rotation</span>
          )}
        </div>
        {fmt && <div className="hs-row__format">{fmt}</div>}
        {isRoomLiveNow && (
          <a
            href={`/session/${session.programSlug}`}
            className="hs-row__join"
            target="_blank"
            rel="noreferrer"
          >
            Enter room →
          </a>
        )}
      </div>
      <div className="hs-row__right">
        <div className="hs-row__who">{statusEl}</div>
        <div className="hs-row__do">
          {actionEl}
          {showCoverageManage && (
            <>
              {/* Ordered least-to-most drastic: ask the team to cover (host
                  stays on) → remove (slot reopens) → take it over myself. */}
              <button className="hs-row__quiet" onClick={() => onAskCoverFor(session)}>
                Ask the team to cover
              </button>
              <button className="hs-row__quiet" onClick={() => onUnassign(session)}>
                Remove
              </button>
              <button className="hs-row__manager" onClick={() => onReassign(session)}>
                Reassign to me
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

const OCC_ORDER = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"] as const;
const OCC_SHORT: Record<string, string> = {
  FIRST: "1st", SECOND: "2nd", THIRD: "3rd", FOURTH: "4th", FIFTH: "5th",
};

/** Format a set of occurrence values into a single readable label. */
function formatOccurrences(occs: Set<string>): string {
  if (occs.has("ALL"))  return "every session";
  if (occs.has("LAST")) return "last of the month";
  const sorted = OCC_ORDER.filter((o) => occs.has(o));
  if (sorted.length === 0) return "—";
  // Named common patterns
  const key = sorted.join(",");
  if (key === "FIRST,SECOND,THIRD,FOURTH") return "every week";
  if (key === "FIRST,THIRD")  return "1st & 3rd of the month";
  if (key === "SECOND,FOURTH") return "2nd & 4th of the month";
  // General
  const labels = sorted.map((o) => OCC_SHORT[o] ?? o.toLowerCase());
  return (labels.length === 1 ? labels[0] : labels.slice(0, -1).join(", ") + " & " + labels[labels.length - 1]) + " of the month";
}

/** Format a next-session ISO datetime as "Tue, May 20 · 8:00 AM" (CT). */
function formatNextSession(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: TZ, hour: "numeric", minute: "2-digit",
  });
  return `${date} · ${time}`;
}

export default function HubScheduleClient({
  initialSessions, programs, teamMembers, initialYear, initialMonth,
  currentUserId, currentUserName,
  isHostManager = false, isManager = false, myRotations = [],
  nextSessionBySlug = {}, apiBase = "/api/host", hubSlug,
  allowsMultipleAssignments = false,
  coverageCopy = { noun: "Host", verb: "hosting", action: "host this" },
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "schedule" = agenda view (default), "rotations" = standing-assignment manager
  // Default "schedule"; honor a ?view=rotations deep-link (from the program
  // staffing page's "Edit rotation" link) so coordinators land on the editing
  // surface, not the agenda. Guarded by isManager — only managers see the tab.
  const [view, setView] = useState<"schedule" | "rotations">(
    () => (isManager && searchParams?.get("view") === "rotations") ? "rotations" : "schedule",
  );

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentUserId);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [modal, setModal] = useState<{ kind: ModalKind; session: Session | null }>({ kind: null, session: null });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Close dropdown on outside click
  const memberPillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (memberPillRef.current && !memberPillRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [memberDropdownOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const hubQuery = hubSlug ? `&hub=${encodeURIComponent(hubSlug)}` : "";
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}${hubQuery}`);
      if (!res.ok) return;
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      showToast("Couldn't load this month.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, hubSlug]);

  // ── Deep-link handling ──
  // ?action=take&id=<sessionId>     — open take modal
  // ?action=cover&id=<subRequestId> — open cover modal
  // ?action=cancel&id=<subRequestId>— open cancel modal (own request only)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const action = searchParams.get("action");
    const id = searchParams.get("id");
    if (!action || !id) return;
    deepLinkHandled.current = true;

    if (action === "take") {
      const s = sessions.find(x => x.id === id);
      if (s) {
        if (s.hostUserId === currentUserId) {
          showToast("You're already hosting this session.");
        } else if (s.status === "claimed" && !s.subRequestId) {
          showToast("This session already has a host.");
        } else {
          setModal({ kind: "take", session: s });
        }
      } else {
        showToast("We couldn't find that session.");
      }
    } else if (action === "cover") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s) setModal({ kind: "cover", session: s });
      else showToast("This request is no longer open.");
    } else if (action === "cancel") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s && s.hostUserId === currentUserId) {
        setModal({ kind: "cancel-request", session: s });
      } else {
        showToast("That request is no longer active.");
      }
    }
  }, [searchParams, sessions, currentUserId]);

  function clearDeepLinkParams() {
    if (searchParams.get("action") || searchParams.get("id")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("action");
      params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }

  function prevMonth() {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m);
  }
  function nextMonth() {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m);
  }
  /** Jump to an arbitrary year+month (CT). Used by the Your Rotations
   *  panel's "Next" affordance so a host can land directly on the month
   *  containing their next rotation-derived session — session 130 fix
   *  for the discoverability gap Maria's beta test surfaced. */
  function jumpToMonth(targetYear: number, targetMonth: number) {
    if (targetYear === year && targetMonth === month) return;
    setYear(targetYear); setMonth(targetMonth); loadMonth(targetYear, targetMonth);
  }
  function goToCurrentMonth() {
    const t = new Date();
    setYear(t.getFullYear()); setMonth(t.getMonth());
    loadMonth(t.getFullYear(), t.getMonth());
  }

  // ── API actions ──

  async function takeSession(s: Session) {
    if (s.id.startsWith("unassigned::")) {
      const res = await fetch(`${apiBase}/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: s.programSlug,
          sessionDate: s.sessionDate,
          action: "claim",
          hubSlug,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Something went wrong.");
      }
      const data = await res.json();
      setSessions(prev => prev.map(row => row.id === s.id
        ? { ...row, id: data.id, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
        : row
      ));
      return;
    }
    const res = await fetch(`${apiBase}/assignments/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
      : row
    ));
  }

  async function coverSession(s: Session) {
    if (!s.subRequestId) throw new Error("This request is no longer open.");
    const res = await fetch(`${apiBase}/sub-requests/${s.subRequestId}/claim`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
      : row
    ));
  }

  async function askForCover(s: Session, message: string | undefined) {
    const text = (message ?? "").replace(/<[^>]+>/g, "").trim();
    const messagePayload = text ? message : null;
    const res = await fetch(`${apiBase}/sub-requests`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: s.id, message: messagePayload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    const data = await res.json().catch(() => ({}));
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "sub_needed", subRequestId: data.id ?? null, subMessage: messagePayload }
      : row
    ));
  }

  async function cancelRequest(s: Session) {
    if (!s.subRequestId) throw new Error("No request to cancel.");
    const res = await fetch(`${apiBase}/sub-requests/${s.subRequestId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", subRequestId: null, subMessage: null }
      : row
    ));
  }

  async function reassign(s: Session) {
    const res = await fetch(`${apiBase}/assignments/reassign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programSlug: s.programSlug,
        sessionDate: s.sessionDate,
        currentAssignmentId: s.id.startsWith("unassigned::") ? null : s.id,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    const data = await res.json();
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, id: data.id, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
      : row
    ));
  }

  // ── Coordinator/manager: remove the current host (slot reopens) ──
  // PATCH unclaim sets userId=null and notifies the removed host server-side.
  // The row stays (it's the session seed) and re-renders as needing coverage,
  // where the "Assign someone…" picker can put someone else on if desired.
  async function unassign(s: Session) {
    const res = await fetch(`${apiBase}/assignments/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unclaim" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Couldn't remove the host.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "unclaimed", hostUserId: null, hostName: null, subRequestId: null, subMessage: null }
      : row
    ));
  }

  // ── Coordinator: assign a chosen teammate to a gap, in place ──
  // Phase 2 slice 1 of the coordinator view. No modal, no page change. The
  // manager/coordinator path on POST /assignments creates the row (or claims
  // an existing empty seed) for the chosen user, validates their hosting
  // capability in this hub, and emails them the confirmation.
  async function assignMember(s: Session, userId: string) {
    if (!userId) return;
    try {
      const res = await fetch(`${apiBase}/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: s.programSlug,
          userId,
          sessionDate: s.sessionDate,
          hubSlug,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Couldn't assign. Please try again.");
      }
      const data = await res.json();
      setSessions(prev => prev.map(row => row.id === s.id
        ? { ...row, id: data.id, status: "claimed", hostUserId: data.hostUserId, hostName: data.hostName, subRequestId: null, subMessage: null }
        : row
      ));
      const who = teamMembers.find(m => m.id === userId)?.displayName ?? data.hostName ?? "host";
      showToast(`Assigned ${who} · ${s.programName} · ${fmtDateShort(s.sessionDate)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't assign. Please try again.");
    }
  }

  // ── Multi-claim sign-up (greeter hub) ──
  // No modal. No sub-request. Open sign-up: POST creates a new
  // HostAssignment scoped to the active hub; reload the month to pick
  // up the new row in the right shape.
  async function signUp(s: Session) {
    if (!s.sessionDate) return;
    const res = await fetch(`${apiBase}/assignments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programSlug: s.programSlug,
        sessionDate: s.sessionDate,
        action: "claim",
        hubSlug,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setToast(d.error ?? "Couldn't sign up. Try again.");
      return;
    }
    setToast("Signed up. Thank you!");
    await loadMonth(year, month);
  }

  async function cancelSignUp(_s: Session, assignmentId: string) {
    const res = await fetch(`${apiBase}/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setToast(d.error ?? "Couldn't cancel. Try again.");
      return;
    }
    setToast("Signup cancelled.");
    await loadMonth(year, month);
  }

  // ── Coordinator/manager: remove ANOTHER person's greeter signup ──
  // Multi-claim hubs only. DELETE is coordinator-gated server-side (scoped to
  // the assignment's hub). Open sign-up is low-ceremony, so this is a direct
  // action with a toast — same shape as "Cancel my signup," no modal. Reload to
  // refresh the claimant list.
  async function removeSignup(_s: Session, assignmentId: string, userName: string | null) {
    const res = await fetch(`${apiBase}/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setToast(d.error ?? "Couldn't remove the signup. Try again.");
      return;
    }
    setToast(userName ? `Removed ${userName}'s signup.` : "Signup removed.");
    await loadMonth(year, month);
  }

  // ── Modal openers ──

  function openTake(s: Session) { setModal({ kind: "take", session: s }); }
  function openCover(s: Session) { setModal({ kind: "cover", session: s }); }
  function openAskCover(s: Session) { setModal({ kind: "ask-cover", session: s }); }
  function openAskCoverFor(s: Session) { setModal({ kind: "ask-cover-for", session: s }); }
  function openCancelRequest(s: Session) { setModal({ kind: "cancel-request", session: s }); }
  function openClearRequest(s: Session) { setModal({ kind: "clear-request", session: s }); }
  function openReassign(s: Session) { setModal({ kind: "reassign", session: s }); }
  function openUnassign(s: Session) { setModal({ kind: "unassign", session: s }); }

  function closeModal() {
    if (modalSubmitting) return;
    setModal({ kind: null, session: null });
    clearDeepLinkParams();
  }

  async function handleConfirm(extra?: any) {
    if (!modal.session) return;
    setModalSubmitting(true);
    try {
      if (modal.kind === "take") {
        await takeSession(modal.session);
        showToast(`You're ${coverageCopy.verb}. The team has been notified.`);
      } else if (modal.kind === "cover") {
        await coverSession(modal.session);
        showToast("You're covering this session. The original host has been notified.");
      } else if (modal.kind === "ask-cover") {
        await askForCover(modal.session, extra);
        showToast("Done. The team will help find a replacement.");
      } else if (modal.kind === "ask-cover-for") {
        const host = modal.session.hostName ?? "the host";
        await askForCover(modal.session, extra);
        showToast(`Cover requested for ${host} · the team has been notified`);
      } else if (modal.kind === "cancel-request") {
        await cancelRequest(modal.session);
        showToast("Request cancelled. You're back to hosting this session.");
      } else if (modal.kind === "clear-request") {
        const host = modal.session.hostName ?? "the host";
        await cancelRequest(modal.session);
        showToast(`Cover request cleared · ${host} stays on`);
      } else if (modal.kind === "reassign") {
        await reassign(modal.session);
        showToast("Reassigned to you.");
      } else if (modal.kind === "unassign") {
        const removedName = modal.session.hostName ?? "Host";
        await unassign(modal.session);
        showToast(`Removed ${removedName} · now needs coverage`);
      }
      setModal({ kind: null, session: null });
      clearDeepLinkParams();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setModalSubmitting(false);
    }
  }

  // ── Derived ──

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayMs = useMemo(() => getTodayStart().getTime(), []);

  const isPast = useCallback((s: Session) => {
    if (!s.sessionDate) return false;
    return new Date(s.sessionDate).getTime() < todayMs;
  }, [todayMs]);

  // Counts:
  //   When viewing the current month, ALL pill counts exclude past sessions
  //   — past sessions appear in the "Earlier this month" collapsible at the
  //   bottom, not in the active counts.
  //   For other months, every session in that month counts (the user
  //   navigated there intentionally to see that month's data).
  //   "Mine" counts the selected member (defaults to self).
  const counts = useMemo(() => {
    let all = 0, needs = 0, mine = 0, myReq = 0;
    for (const s of sessions) {
      const past = isPast(s);
      if (isCurrentMonth && past) continue;
      all++;
      const isSelectedMembers = sessionBelongsTo(s, selectedMemberId);
      const isMine = sessionBelongsTo(s, currentUserId);
      if (isSelectedMembers) mine++;
      if (isMine && s.subRequestId) myReq++;
      if (!isMine && (s.status !== "claimed" || s.subRequestId)) needs++;
    }
    return { all, needs, mine, myReq };
  }, [sessions, currentUserId, selectedMemberId, isPast, isCurrentMonth]);

  // Apply active filter. "Mine" filter scopes to selectedMemberId.
  const filteredSessions = useMemo(() => {
    if (filter === "all") return sessions;
    if (filter === "needs") {
      return sessions.filter(s =>
        s.hostUserId !== currentUserId &&
        (s.status !== "claimed" || s.subRequestId)
      );
    }
    if (filter === "mine") {
      return sessions.filter(s => sessionBelongsTo(s, selectedMemberId));
    }
    if (filter === "my-requests") {
      return sessions.filter(s =>
        s.hostUserId === currentUserId && s.subRequestId
      );
    }
    return sessions;
  }, [sessions, filter, currentUserId, selectedMemberId]);

  // When viewing the current month, split past from upcoming.
  // Past goes into a collapsible "Earlier this month" section at the bottom.
  // For other months, all sessions render in-flow.
  const upcomingSessions = useMemo(() =>
    isCurrentMonth ? filteredSessions.filter(s => !isPast(s)) : filteredSessions,
    [filteredSessions, isCurrentMonth, isPast],
  );
  const pastSessions = useMemo(() =>
    isCurrentMonth ? filteredSessions.filter(isPast) : [],
    [filteredSessions, isCurrentMonth, isPast],
  );

  const upcomingBuckets = useMemo(() => bucketByWeek(upcomingSessions, isCurrentMonth), [upcomingSessions, isCurrentMonth]);
  const pastBuckets = useMemo(() => bucketByWeek(pastSessions, isCurrentMonth), [pastSessions, isCurrentMonth]);

  const monthLabel = `${MONTHS[month]} ${year}`;

  // Empty state. When there are no sessions, the message is filter-aware so
  // a "no results in this filter" reads differently from "no programs at
  // all in this hub." For non-host-team hubs (peer-led, audio-visual,
  // greeter) the all-empty case usually means no programs have been
  // tagged with this hub's coverage yet — surface a concrete next step
  // so the page reads as "ready for setup" rather than broken.
  const emptyMsg = (() => {
    if (filteredSessions.length > 0) return null;
    if (filter === "all") {
      if (programs.length === 0 && hubSlug && hubSlug !== DEFAULT_HOSTING_HUB_SLUG) {
        return `No programs are scheduled with this team yet. A coordinator can tag a program in the Program editor → Hosting & Access → Auxiliary role coverage.`;
      }
      return `No sessions in ${MONTHS[month]}.`;
    }
    if (filter === "needs") return "Everything is covered. Thank you, team.";
    if (filter === "mine") {
      // Context-aware: the member picker lets a coordinator view anyone's
      // schedule, so a self-referential "You're not hosting" reads wrong
      // when you're looking at someone else (session 140, #3).
      // Role-aware: the verb reads "hosting" / "greeting" / "covering AV" /
      // "facilitating" per the hub's coverageCopy. Dropping "anything" keeps it
      // grammatical for the multi-word verbs ("covering AV here", not
      // "covering AV anything here").
      if (selectedMemberId === currentUserId) return `You're not ${coverageCopy.verb} here.`;
      const who = teamMembers.find((m) => m.id === selectedMemberId)?.displayName ?? "This person";
      return `${who} isn't ${coverageCopy.verb} here.`;
    }
    if (filter === "my-requests") return "You haven't asked the team to cover any sessions.";
    return null;
  })();

  const rowHandlers = {
    onTake: openTake,
    onCover: openCover,
    onAskCover: openAskCover,
    onAskCoverFor: openAskCoverFor,
    onCancelRequest: openCancelRequest,
    onClearRequest: openClearRequest,
    onReassign: openReassign,
    onUnassign: openUnassign,
    onSignUp: signUp,
    onCancelSignUp: cancelSignUp,
    onRemoveSignup: removeSignup,
    currentUserId,
    isHostManager,
    coverageCopy,
    isManager,
    teamMembers,
    onAssign: assignMember,
    allowsMultipleAssignments,
  };

  return (
    <div className="hs-page">

      {/* View tab strip — Schedule | Rotations (manager/coordinator only).
          Gated by isManager (the broader hub-aware check that includes
          coordinators of the active hub), NOT isHostManager (which is
          the global HOST_MANAGER role only). The previous gate hid the
          Rotations tab from peer-led-silent-meditation coordinators who
          weren't also global HOST_MANAGERs — Jesse caught this post-2.6. */}
      {isManager && (
        <div className="hs-viewtabs" role="tablist" aria-label="Schedule views">
          <button
            role="tab"
            aria-selected={view === "schedule"}
            className={`hs-viewtab${view === "schedule" ? " hs-viewtab--active" : ""}`}
            onClick={() => setView("schedule")}
          >
            Schedule
          </button>
          <button
            role="tab"
            aria-selected={view === "rotations"}
            className={`hs-viewtab${view === "rotations" ? " hs-viewtab--active" : ""}`}
            onClick={() => setView("rotations")}
          >
            Rotations
          </button>
        </div>
      )}

      {/* Rotations view */}
      {/* When rotations apply changes, refresh the schedule's local sessions
          state so the new HostAssignments + via-rotation markers appear when
          the user switches back to Schedule. */}
      {view === "rotations" && (
        <RotationsClient
          programs={programs}
          teamMembers={teamMembers}
          year={year}
          month={month + 1}
          isManager={isManager}
          hubSlug={hubSlug}
          onScheduleStale={() => loadMonth(year, month)}
        />
      )}

      {/* Schedule view — hidden when rotations is active */}
      {view === "schedule" && <>

      {/* Your standing rotations — host-side awareness panel.
          One card per program. Multiple occurrence records for the same program
          (e.g. FIRST + THIRD from an alternate pattern) are grouped and the
          occurrences formatted as a single readable label. The right column
          shows the next upcoming HostAssignment datetime for that program. */}
      {myRotations.length > 0 && (() => {
        const grouped = new Map<string, { programName: string; occs: Set<string>; endsOn: string | null }>();
        for (const r of myRotations) {
          if (!grouped.has(r.programSlug)) {
            grouped.set(r.programSlug, { programName: r.programName, occs: new Set(), endsOn: r.endsOn });
          }
          grouped.get(r.programSlug)!.occs.add(r.occurrence);
        }
        return (
          <div className="hs-myrot">
            <p className="hs-myrot__heading">Your rotations</p>
            {Array.from(grouped.entries()).map(([slug, g]) => {
              const patLabel  = formatOccurrences(g.occs);
              const endsLabel = g.endsOn
                ? new Date(g.endsOn).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : null;
              const meta      = [patLabel, endsLabel ? `until ${endsLabel}` : null].filter(Boolean).join(" · ");
              const nextIso   = nextSessionBySlug[slug] ?? null;
              const nextLabel = nextIso ? formatNextSession(nextIso) : null;
              // Compute the target month (in CT) so the "Next" button can
              // jump the calendar there. Session 130 — closes the
              // discoverability gap where Maria couldn't find the
              // sub-request affordance from the current month because her
              // rotation rows were all in a future month.
              //
              // Use `Intl.DateTimeFormat(..., { timeZone }).formatToParts()`
              // rather than round-tripping a locale-formatted string through
              // `new Date()`. Locale-string parsing is not in the ECMA spec
              // and Safari has historically failed on common shapes —
              // reviewer flagged in finding #3. This pattern is engine-
              // agnostic and gives integers directly.
              const nextTarget = (() => {
                if (!nextIso) return null;
                const d = new Date(nextIso);
                if (Number.isNaN(d.getTime())) return null;
                const parts = new Intl.DateTimeFormat("en-US", {
                  timeZone: TZ,
                  year:  "numeric",
                  month: "numeric",
                }).formatToParts(d);
                const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "", 10);
                const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "", 10);
                if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
                return { year: y, month: m - 1 }; // JS month is 0-indexed
              })();
              const isAlreadyHere =
                nextTarget !== null &&
                nextTarget.year === year &&
                nextTarget.month === month;
              return (
                <div key={slug} className="hs-myrot__card">
                  <div className="hs-myrot__left">
                    <p className="hs-myrot__prog">{g.programName}</p>
                    <p className="hs-myrot__meta">{meta}</p>
                  </div>
                  {nextLabel && nextTarget && (
                    isAlreadyHere ? (
                      <div className="hs-myrot__right">
                        <p className="hs-myrot__next-label">Next</p>
                        <p className="hs-myrot__next-date">{nextLabel}</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="hs-myrot__right hs-myrot__right--jump"
                        onClick={() => jumpToMonth(nextTarget.year, nextTarget.month)}
                        aria-label={`Jump to ${nextLabel}`}
                      >
                        <p className="hs-myrot__next-label">Next →</p>
                        <p className="hs-myrot__next-date">{nextLabel}</p>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Month nav */}
      <div className="hs-monthnav">
        <button className="hs-monthnav__btn" onClick={prevMonth} aria-label="Previous month">←</button>
        <h1 className="hs-monthnav__label">{monthLabel}</h1>
        <button className="hs-monthnav__btn" onClick={nextMonth} aria-label="Next month">→</button>
        {!isCurrentMonth && (
          <button className="hs-monthnav__today" onClick={goToCurrentMonth}>This month</button>
        )}
      </div>

      {/* The coverage-gap signal lives on the "Needs help" pill below — it
          goes amber when sessions are uncovered (session 141). One affordance
          instead of a separate banner that duplicated the pill's count. */}

      {/* Filter pills */}
      <div className="hs-filters" role="tablist" aria-label="Filter sessions">
        <button
          role="tab"
          aria-selected={filter === "all"}
          className={`hs-filter${filter === "all" ? " hs-filter--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span className="hs-filter__count">{counts.all}</span>
        </button>
        <button
          role="tab"
          aria-selected={filter === "needs"}
          className={`hs-filter${filter === "needs" ? " hs-filter--active" : ""}${
            isManager && !allowsMultipleAssignments && counts.needs > 0 && filter !== "needs"
              ? " hs-filter--alert"
              : ""
          }`}
          onClick={() => setFilter("needs")}
        >
          Needs help <span className="hs-filter__count">{counts.needs}</span>
        </button>

        {/* Member-picker pill — defaults to "Mine" (self), can switch to any
            host-team member. Body click = activate filter, arrow = open list. */}
        <div className="hs-filter-group" ref={memberPillRef}>
          <button
            role="tab"
            aria-selected={filter === "mine"}
            className={`hs-filter hs-filter--member${filter === "mine" ? " hs-filter--active" : ""}`}
            onClick={() => {
              setFilter("mine");
              setMemberDropdownOpen(false);
            }}
          >
            <span className="hs-filter__label">
              {selectedMemberId === currentUserId
                ? "Mine"
                : (teamMembers.find(m => m.id === selectedMemberId)?.displayName ?? "Member")}
            </span>
            <span className="hs-filter__count">{counts.mine}</span>
          </button>
          <button
            type="button"
            className={`hs-filter__caret${filter === "mine" ? " hs-filter__caret--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMemberDropdownOpen(v => !v);
            }}
            aria-label="Choose a team member"
            aria-expanded={memberDropdownOpen}
          >
            ▾
          </button>
          {memberDropdownOpen && (
            <div className="hs-member-menu" role="menu">
              <button
                role="menuitem"
                className={`hs-member-menu__item${selectedMemberId === currentUserId ? " hs-member-menu__item--active" : ""}`}
                onClick={() => {
                  setSelectedMemberId(currentUserId);
                  setFilter("mine");
                  setMemberDropdownOpen(false);
                }}
              >
                Mine
              </button>
              {teamMembers.length > 0 && <div className="hs-member-menu__divider" />}
              {teamMembers.map(m => (
                <button
                  key={m.id}
                  role="menuitem"
                  className={`hs-member-menu__item${selectedMemberId === m.id ? " hs-member-menu__item--active" : ""}`}
                  onClick={() => {
                    setSelectedMemberId(m.id);
                    setFilter("mine");
                    setMemberDropdownOpen(false);
                  }}
                >
                  {m.displayName}
                  {m.isCoordinator && <span className="hs-member-menu__star" aria-label="coordinator"> ★</span>}
                  {m.id === currentUserId && <span className="hs-member-menu__you"> (you)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedMemberId === currentUserId && counts.myReq > 0 && (
          <button
            role="tab"
            aria-selected={filter === "my-requests"}
            className={`hs-filter${filter === "my-requests" ? " hs-filter--active" : ""}`}
            onClick={() => setFilter("my-requests")}
          >
            My requests <span className="hs-filter__count">{counts.myReq}</span>
          </button>
        )}

      </div>

      {/* Body */}
      {loading ? (
        <p className="hs-loading">Loading…</p>
      ) : emptyMsg ? (
        <div className="hs-allset">
          <p className="hs-allset__heading">{emptyMsg}</p>
        </div>
      ) : (
        <>
          {upcomingBuckets.map(b => (
            <section key={b.weekStartMs} className="hs-week">
              <header className="hs-week__header">
                <h2 className="hs-week__label">{b.label}</h2>
                <span className="hs-week__count">
                  {b.sessions.length} {b.sessions.length === 1 ? "session" : "sessions"}
                </span>
              </header>
              <div className="hs-week__list">
                {b.sessions.map(s => (
                  <HsRow
                    key={s.id}
                    session={s}
                    kind={rowKind(s, currentUserId)}
                    isPast={false}
                    {...rowHandlers}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Earlier this month — collapsed by default for current-month views */}
          {pastBuckets.length > 0 && (
            <details className="hs-past">
              <summary className="hs-past__summary">
                Earlier this month — {pastSessions.length}{" "}
                {pastSessions.length === 1 ? "session" : "sessions"}
              </summary>
              <div className="hs-past__content">
                {pastBuckets.map(b => (
                  <section key={b.weekStartMs} className="hs-week">
                    <header className="hs-week__header">
                      <h2 className="hs-week__label">{b.label}</h2>
                      <span className="hs-week__count">
                        {b.sessions.length} {b.sessions.length === 1 ? "session" : "sessions"}
                      </span>
                    </header>
                    <div className="hs-week__list">
                      {b.sessions.map(s => (
                        <HsRow
                          key={s.id}
                          session={s}
                          kind={rowKind(s, currentUserId)}
                          isPast
                          {...rowHandlers}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          )}

          {/* If only past content exists in current month, show a hint */}
          {upcomingBuckets.length === 0 && pastBuckets.length > 0 && isCurrentMonth && (
            <div className="hs-allset">
              <p className="hs-allset__heading">
                Nothing left this month. The next sessions are in {MONTHS[(month + 1) % 12]}.
              </p>
            </div>
          )}
        </>
      )}

      <HsModal
        kind={modal.kind}
        session={modal.session}
        onConfirm={handleConfirm}
        onCancel={closeModal}
        submitting={modalSubmitting}
      />

      <Toast msg={toast} />

      </> /* end schedule view */}
    </div>
  );
}
