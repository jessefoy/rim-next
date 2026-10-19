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
import { ActionNotice, useActionNotice } from "@/components/FormDone";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { HubCoverageCopy } from "@/lib/programHub";
import { COVERAGE_LOOKAHEAD_DAYS, EARLY_OPEN_MIN, LATE_GRACE_MIN, FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import type { ScheduleProgramSummary, ScheduleSessionRow } from "@/lib/scheduleSessions";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 60 }} /> },
);

const RotationsClient = dynamic(
  () => import("@/components/RotationsClient"),
  { ssr: false, loading: () => <p className="hs-loading">Loading rotations…</p> },
);

// Row shapes come from the one builder (lib/scheduleSessions.ts, 2026-10-15).
type Session = ScheduleSessionRow;

/** Programs created within this many days show a NEW badge on schedule cards. */
const NEW_PROGRAM_DAYS = 14;

type Program = ScheduleProgramSummary;

interface TeamMember {
  /** Can be put on a session or rotation (ACTIVE, on the schedule). */
  canCover?: boolean;
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
  /** The team's display name. */
  hubName?: string;
  /** The viewer may take sessions on this team's schedule. */
  canClaim?: boolean;
  /** The team runs the session (hub.hasSchedule), as opposed to staffing a
   *  supporting role: picks the empty-state instructions. */
  hostsSessions?: boolean;
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
function fmtDateBlock(iso: string | null): { weekday: string; month: string; day: string; label: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: TZ }).toUpperCase(),
    day: date.toLocaleDateString("en-US", { day: "numeric", timeZone: TZ }),
    label: fmtDateLong(iso),
  };
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

function rowKind(s: Session, currentUserId: string, openSignUp = false): RowKind {
  // Every session on an open sign-up team (greeter) renders as the sign-up
  // list, empty ones too ("No greeters yet. Be the first?"). Keyed on the
  // team's setting: an empty session carries no claimants and an unassigned
  // id, so it used to fall through to the single-host "Greeter needed" row
  // (2026-10-15). Session 129.
  if (openSignUp || (s.claimants && s.claimants.length > 0) || s.id.startsWith("multi::")) {
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

// ── Modal ───────────────────────────────────────────────────

type ModalKind = "take" | "cover" | "ask-cover" | "ask-cover-for" | "cancel-request" | "clear-request" | "reassign" | "unassign" | "remove-signup" | "cancel-signup" | null;

/** The role after "needs": "a greeter", "a host", but "AV". */
function needsRoleOf(copy: HubCoverageCopy): string {
  if (/^[A-Z0-9/&]+$/.test(copy.noun)) return copy.noun;
  const role = copy.noun.toLowerCase();
  return `${/^[aeiou]/.test(role) ? "an" : "a"} ${role}`;
}

/** Whether the team is told at once when this session empties (2026-10-16
 *  ruling: within two weeks; further out, the Monday look-ahead says it). */
function withinNoticeWindow(s: { sessionDate: string | null }): boolean {
  if (!s.sessionDate) return false;
  const t = new Date(s.sessionDate).getTime();
  return t > Date.now() && t <= Date.now() + COVERAGE_LOOKAHEAD_DAYS * 86_400_000;
}

interface ModalProps {
  kind: ModalKind;
  session: Session | null;
  /** remove-signup: whose sign-up. */
  signup?: { assignmentId: string; userName: string | null } | null;
  onConfirm: (extra?: any) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
  /** A failed confirm, said beside the button inside the modal. */
  error?: string | null;
  /** The team's own words ("Host" / "hosting" / "host this"; "AV" /
   *  "covering AV" / "cover AV"). Sentences that would read wrongly with
   *  them stay neutral and name the person instead (2026-10-15). */
  coverageCopy: HubCoverageCopy;
}

function HsModal({ kind, session, signup, onConfirm, onCancel, submitting, error, coverageCopy }: ModalProps) {
  const [coverNote, setCoverNote] = useState<string>("");

  useEffect(() => {
    if (kind === "ask-cover" || kind === "ask-cover-for") setCoverNote("");
  }, [kind, session?.id]);

  // A real dialog (2026-10-16 audit): focus moves into it on open and back to
  // where it was on close, and Escape closes it unless a save is running.
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ onCancel, submitting });
  useEffect(() => { latest.current = { onCancel, submitting }; });
  const open = !!kind && !!session;
  // Taking someone off starts on the safe choice, so one Enter can't remove them.
  const destructive = kind === "unassign" || kind === "remove-signup" || kind === "clear-request" || kind === "reassign";
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    (destructive ? cancelRef : primaryRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Not from inside the note editor, or when an inner control handled it.
      const inEditor = (e.target as HTMLElement | null)?.closest?.("[contenteditable='true']");
      if (e.key === "Escape" && !e.defaultPrevented && !inEditor && !latest.current.submitting) {
        latest.current.onCancel();
        return;
      }
      // Keep Tab inside the dialog (it is modal).
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input, select, textarea, [contenteditable='true'], [tabindex]:not([tabindex='-1'])",
        );
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on open/close only; `destructive` is fixed while open
  }, [open]);

  if (!kind || !session) return null;

  const dateStr = fmtDateLong(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);

  let title = "";
  let body: React.ReactNode = "";
  let primaryLabel = "";
  let extraInput: React.ReactNode = null;
  let cancelLabel = "Not yet";

  if (kind === "take") {
    title = "Take this session?";
    body = (
      <><strong>{session.programName}</strong> on <strong>{dateStr}</strong>{" "}
      at <strong>{timeStr}</strong> will be yours. We&apos;ll email you a
      confirmation.</>
    );
    primaryLabel = `Yes, I'll ${coverageCopy.action}`;
  } else if (kind === "cover") {
    title = "Confirm covering";
    body = (
      <>You'll cover for <strong>{session.hostName ?? "the person who asked"}</strong>{" "}
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
        <p className="hs-modal__field-label">Add a note (optional)</p>
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
      <>Ask the team to cover for <strong>{session.hostName ?? "this person"}</strong>{" "}
      on <strong>{dateStr}</strong> for <strong>{session.programName}</strong>.
      The team will receive an email and someone may step in.{" "}
      <strong>{session.hostName ?? "This person"}</strong> stays on until
      someone does.</>
    );
    primaryLabel = "Send to the team";
    extraInput = (
      <div className="hs-modal__field">
        <p className="hs-modal__field-label">Add a note (optional)</p>
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
      <><strong>{session.programName}</strong> on <strong>{dateStr}</strong>{" "}
      stays yours. The team will know your request is closed.</>
    );
    primaryLabel = "Yes, cancel the request";
    cancelLabel = "Keep the request";
  } else if (kind === "clear-request") {
    title = "Clear this cover request?";
    body = (
      <>This closes the cover request for <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong>. <strong>{session.hostName ?? "The person on it"}</strong>{" "}
      keeps the session.</>
    );
    primaryLabel = "Yes, clear the request";
    cancelLabel = "Keep the request";
  } else if (kind === "reassign") {
    title = "Reassign to yourself";
    body = session.hostUserId
      ? (
        <>This will remove <strong>{session.hostName ?? "the person on it now"}</strong>{" "}
        from <strong>{session.programName}</strong> on <strong>{dateStr}</strong>{" "}
        and assign you. They will be notified. Any open cover request will be closed.</>
      )
      : (
        <>This will assign you to <strong>{session.programName}</strong> on{" "}
        <strong>{dateStr}</strong>.</>
      );
    primaryLabel = "Yes, reassign to me";
  } else if (kind === "unassign") {
    title = "Remove them from this session?";
    body = (
      <>This takes <strong>{session.hostName ?? "the person on it now"}</strong> off{" "}
      <strong>{session.programName}</strong> on <strong>{dateStr}</strong>. The
      session reopens as needing coverage, and they&apos;ll be notified. Any open
      cover request will be closed.
      {withinNoticeWindow(session) ? <> The team will hear that it needs {needsRoleOf(coverageCopy)}.</> : null}</>
    );
    primaryLabel = "Yes, remove";
    cancelLabel = "Keep them on";
  } else if (kind === "remove-signup") {
    // A coordinator removing someone else's sign-up (open sign-up teams). It
    // was one tap on a small link, with no confirmation (2026-10-16 audit).
    title = "Remove this sign-up?";
    body = (
      <>This takes <strong>{signup?.userName ?? "this person"}</strong> off{" "}
      <strong>{session.programName}</strong> on <strong>{dateStr}</strong>.
      They&apos;ll be notified.
      {withinNoticeWindow(session) && session.claimants.filter((c) => c.userId).length <= 1
        ? <> No one else is signed up, so the team will hear that it needs {needsRoleOf(coverageCopy)}.</>
        : null}</>
    );
    primaryLabel = "Yes, remove";
    cancelLabel = "Keep them on";
  } else if (kind === "cancel-signup") {
    // Only when they're the last one signed up (2026-10-16: a greeter's
    // cancel left a session with no one, and nobody heard).
    title = "Cancel your sign-up?";
    body = (
      <>You&apos;re the only {coverageCopy.noun === coverageCopy.noun.toUpperCase() ? coverageCopy.noun : coverageCopy.noun.toLowerCase()} for{" "}
      <strong>{session.programName}</strong> on <strong>{dateStr}</strong>.{" "}
      {withinNoticeWindow(session)
        ? <>If you cancel, it will show on the schedule as needing {needsRoleOf(coverageCopy)}, and the team will hear.</>
        : <>If you cancel, it will show on the schedule as needing {needsRoleOf(coverageCopy)}.</>}</>
    );
    primaryLabel = "Yes, cancel my sign-up";
    cancelLabel = "Keep my sign-up";
  }

  return (
    <div className="hs-modal-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="hs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hs-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="hs-modal__title" id="hs-modal-title">{title}</h2>
        <div className="hs-modal__body">{body}</div>
        {extraInput}
        {error && (
          <p className="save-note save-note--error hs-modal__error" role="alert">
            {error}
          </p>
        )}
        <div className="hs-modal__actions">
          <button
            ref={primaryRef}
            className="lr-btn lr-btn--host hs-modal__primary"
            onClick={() => onConfirm(kind === "ask-cover" || kind === "ask-cover-for" ? coverNote : undefined)}
            disabled={submitting}
          >
            {submitting ? "Working…" : primaryLabel}
          </button>
          <button
            ref={cancelRef}
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
  onSignUp?: (s: Session) => Promise<void> | void;
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
  teamMembers: { id: string; displayName: string; isCoordinator: boolean; canCover?: boolean }[];
  onAssign: (s: Session, userId: string) => Promise<void>;
  /** Multi-claim hub (greeter): open sign-up model. Suppresses single-slot
   *  affordances that don't apply (the assign-others picker on empty rows). */
  allowsMultipleAssignments?: boolean;
  /** The viewer may take sessions here (the server's own rule). Without it
   *  the take, cover and sign-up buttons aren't offered (2026-10-16). */
  canClaim: boolean;
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
  teamMembers: { id: string; displayName: string; isCoordinator: boolean; canCover?: boolean }[];
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
      aria-label={`Choose a person to assign to ${session.programName} on ${fmtDateLong(session.sessionDate)}`}
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
      {/* Only people who can be scheduled: paused or off-schedule members
          would be refused (2026-10-16 audit). */}
      {teamMembers.filter((m) => m.canCover !== false).map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}{m.isCoordinator ? " ★" : ""}
        </option>
      ))}
    </select>
  );
}

/** The open sign-up button: shows the work and can't be pressed twice. */
function SignUpButton({ label, onSignUp }: { label: string; onSignUp: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="lr-btn lr-btn--host"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onSignUp();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Signing you up…" : label}
    </button>
  );
}

function HsRow({
  session, kind, isPast, currentUserId,
  onTake, onCover, onAskCover, onAskCoverFor, onCancelRequest, onClearRequest, onReassign, onUnassign,
  onSignUp, onCancelSignUp, onRemoveSignup, canClaim,
  isHostManager,
  coverageCopy,
  isManager, teamMembers, onAssign, allowsMultipleAssignments,
}: RowProps) {
  const dateBlock = fmtDateBlock(session.sessionDate);
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
    if (!session.opensRoom) return false;
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
  // An abbreviation the team wrote in capitals (AV) stays as written, for
  // any team, not just one named here (2026-10-15).
  const nounLower = /^[A-Z0-9/&]+$/.test(coverageCopy.noun)
    ? coverageCopy.noun
    : coverageCopy.noun.toLowerCase();
  const nounCap   = coverageCopy.noun;

  switch (kind) {
    case "needs-host":
      statusEl = <span className="hs-row__status hs-row__status--needs">{isPast ? `No ${nounLower} (missed)` : `${nounCap} needed`}</span>;
      if (!isPast) {
        actionEl = (
          <div className="hs-row__action-stack">
            {canClaim && (
              <button className="lr-btn lr-btn--host" onClick={() => onTake(session)}>
                Yes, I can {coverageCopy.action}
              </button>
            )}
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
            ? "No one covered"
            : (session.hostName ? `${session.hostName} needs help` : "Needs cover")}
        </span>
      );
      if (!isPast) {
        actionEl = (
          <div className="hs-row__action-stack">
            {canClaim && (
              <button className="lr-btn lr-btn--host" onClick={() => onCover(session)}>
                Yes, I can cover
              </button>
            )}
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
          <span className="hs-row__status-label">{nounCap}</span>
          <span className="hs-row__status-name">{session.hostName ?? "—"}</span>
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

      // Role-aware header via the hub's coverageNoun ("greeter" / "AV" /
      // "facilitator"), pluralized. "We have N greeters" reads as the team
      // it is, not a generic "N people signed up" (session 146 follow-up).
      // Keeps the self-recognition ("that's you" / "you're one of them").
      const nounPlural = `${nounLower}s`;
      let headerText: string;
      if (count === 0) {
        headerText = isPast ? `No ${nounPlural}` : `No ${nounPlural} yet. Be the first?`;
      } else if (count === 1) {
        headerText = mine ? `We have 1 ${nounLower}: that's you` : `We have 1 ${nounLower}`;
      } else {
        headerText = mine
          ? `We have ${count} ${nounPlural}, and you're one of them`
          : `We have ${count} ${nounPlural}`;
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
          : canClaim
            ? (
              <SignUpButton
                label={count === 0 ? "I’ll be the first" : "I’ll be there too"}
                onSignUp={() => onSignUp?.(session)}
              />
            )
            : null;
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
        {dateBlock ? (
          <time className="hs-row__date-block" dateTime={session.sessionDate ?? undefined} aria-label={`${dateBlock.label} at ${timeStr}`}>
            <span className="hs-row__date-weekday">{dateBlock.weekday}</span>
            <span className="hs-row__date-month">{dateBlock.month}</span>
            <span className="hs-row__date-day">{dateBlock.day}</span>
            <span className="hs-row__time">{timeStr}</span>
          </time>
        ) : (
          <span className="hs-row__date">Date to be confirmed</span>
        )}
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
            href={`/session/${session.programSlug}/enter`}
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
            <details className="hs-row__manage">
              <summary>Manage coverage</summary>
              <div className="hs-row__manage-actions">
                {/* Ordered least-to-most disruptive: ask the team to cover
                    (the person stays assigned) → remove → take it over. */}
                <button className="hs-row__quiet" onClick={() => onAskCoverFor(session)}>
                  Ask the team to cover
                </button>
                <button className="hs-row__quiet" onClick={() => onUnassign(session)}>
                  Remove {nounLower}
                </button>
                {canClaim && (
                  <button className="hs-row__manager" onClick={() => onReassign(session)}>
                    Reassign to me
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

export default function HubScheduleClient({
  initialSessions, programs, teamMembers, initialYear, initialMonth,
  currentUserId, currentUserName,
  isHostManager = false, isManager = false,
  apiBase = "/api/host", hubSlug,
  allowsMultipleAssignments = false,
  hubName, hostsSessions = false, canClaim = false,
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
  // Each action's answer stays until closed or the next action (ActionNotice).
  const { notice: toast, say: setToast } = useActionNotice();
  const [modalError, setModalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentUserId);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [modal, setModal] = useState<{
    kind: ModalKind;
    session: Session | null;
    signup?: { assignmentId: string; userName: string | null } | null;
  }>({ kind: null, session: null });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Close dropdown on outside click
  const memberPillRef = useRef<HTMLDivElement>(null);
  const memberCaretRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (memberPillRef.current && !memberPillRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    };
    // Escape closes the menu and returns focus to the button that opened it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMemberDropdownOpen(false);
      memberCaretRef.current?.focus();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [memberDropdownOpen]);

  const showToast = setToast;

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const hubQuery = hubSlug ? `&hub=${encodeURIComponent(hubSlug)}` : "";
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}${hubQuery}`);
      if (!res.ok) {
        showToast("Couldn't load this month. Please try again.", "error");
        return;
      }
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      showToast("Couldn't load this month. Please try again.", "error");
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
          showToast("This session is already yours.", "error");
        } else if (s.status === "claimed" && !s.subRequestId) {
          showToast("Someone already has this session.", "error");
        } else {
          setModal({ kind: "take", session: s });
        }
      } else {
        showToast("We couldn't find that session.", "error");
      }
    } else if (action === "cover") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s) setModal({ kind: "cover", session: s });
      else showToast("This request is no longer open.", "error");
    } else if (action === "cancel") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s && s.hostUserId === currentUserId) {
        setModal({ kind: "cancel-request", session: s });
      } else {
        showToast("That request is no longer active.", "error");
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
      ? { ...row, status: "sub_needed", subRequestId: data.id ?? null, subMessage: messagePayload ?? null }
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
      throw new Error(d.error ?? "Couldn't take them off. Please try again.");
    }
    const d = await res.json().catch(() => ({}));
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "unclaimed", hostUserId: null, hostName: null, subRequestId: null, subMessage: null }
      : row
    ));
    return d?.teamTold === true;
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
      const who = teamMembers.find(m => m.id === userId)?.displayName ?? data.hostName ?? "them";
      showToast(`Assigned ${who} · ${s.programName} · ${fmtDateShort(s.sessionDate)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't assign. Please try again.", "error");
    }
  }

  // ── Multi-claim sign-up (greeter hub) ──
  // No modal. No sub-request. Open sign-up: POST creates a new
  // HostAssignment scoped to the active hub; reload the month to pick
  // up the new row in the right shape.
  async function signUp(s: Session) {
    if (!s.sessionDate) return;
    setToast(null);
    const res = await fetch(`${apiBase}/assignments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programSlug: s.programSlug,
        sessionDate: s.sessionDate,
        action: "claim",
        hubSlug,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setToast(d?.error ?? "You weren\u2019t signed up. Please check your connection and try again.", "error");
      return;
    }
    setToast(`You're ${coverageCopy.verb} at ${s.programName}. Thank you! We'll email you a confirmation.`);
    await loadMonth(year, month);
  }

  // Cancelling your own sign-up. When you're the last one on the session it
  // asks first and says who will be told (2026-10-16); otherwise it's one tap.
  async function cancelSignUp(s: Session, assignmentId: string) {
    const others = s.claimants.filter((c) => c.userId && c.userId !== currentUserId).length;
    if (others === 0) {
      setModal({ kind: "cancel-signup", session: s, signup: { assignmentId, userName: null } });
      return;
    }
    try {
      await deleteMySignUp(s, assignmentId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't cancel. Try again.", "error");
    }
  }

  async function deleteMySignUp(s: Session, assignmentId: string) {
    const res = await fetch(`${apiBase}/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Couldn't cancel. Try again.");
    setToast(d?.teamTold
      ? `Sign-up cancelled. We've let the team know ${s.programName} needs ${needsRoleOf(coverageCopy)}.`
      : "Sign-up cancelled.");
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
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Said inside the dialog, beside its button.
      throw new Error(d.error ?? "Couldn't remove the sign-up. Please try again.");
    }
    const removed = userName ? `Removed ${userName}'s sign-up.` : "Sign-up removed.";
    setToast(d?.teamTold ? `${removed} We've let the team know the session needs ${needsRoleOf(coverageCopy)}.` : removed);
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
    setModalError(null);
    setModal({ kind: null, session: null });
    clearDeepLinkParams();
  }

  async function handleConfirm(extra?: any) {
    if (!modal.session) return;
    setModalSubmitting(true);
    setModalError(null);
    setToast(null);
    try {
      if (modal.kind === "take") {
        await takeSession(modal.session);
        showToast(`You're ${coverageCopy.verb} at ${modal.session.programName}. We'll email you a confirmation.`);
      } else if (modal.kind === "cover") {
        await coverSession(modal.session);
        showToast("You're covering this session. They've been notified.");
      } else if (modal.kind === "ask-cover") {
        await askForCover(modal.session, extra);
        showToast("Done. The team will help find a replacement.");
      } else if (modal.kind === "ask-cover-for") {
        const host = modal.session.hostName ?? "them";
        await askForCover(modal.session, extra);
        showToast(`Cover requested for ${host} · the team has been notified`);
      } else if (modal.kind === "cancel-request") {
        await cancelRequest(modal.session);
        showToast("Request cancelled. The session is yours again.");
      } else if (modal.kind === "clear-request") {
        const host = modal.session.hostName;
        await cancelRequest(modal.session);
        showToast(host ? `Cover request cleared. ${host} keeps the session.` : "Cover request cleared. They keep the session.");
      } else if (modal.kind === "reassign") {
        await reassign(modal.session);
        showToast("Reassigned to you.");
      } else if (modal.kind === "remove-signup" && modal.signup) {
        await removeSignup(modal.session, modal.signup.assignmentId, modal.signup.userName);
      } else if (modal.kind === "cancel-signup" && modal.signup) {
        await deleteMySignUp(modal.session, modal.signup.assignmentId);
      } else if (modal.kind === "unassign") {
        const removedName = modal.session.hostName;
        const told = await unassign(modal.session);
        const removed = removedName ? `Removed ${removedName}.` : "Removed.";
        showToast(told
          ? `${removed} We've let the team know the session needs ${needsRoleOf(coverageCopy)}.`
          : `${removed} The session needs ${needsRoleOf(coverageCopy)}.`);
      }
      setModal({ kind: null, session: null });
      clearDeepLinkParams();
    } catch (e) {
      // The modal stays open, so the problem is said there, beside its button.
      setModalError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
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
      if (programs.length === 0) {
        return hostsSessions
          ? "No programs are hosted by this team yet. In the Program editor, choose this team under Hosting & Access → Hosting team."
          : "No programs are scheduled with this team yet. A coordinator can add this team in the Program editor under Hosting & Access → Auxiliary role coverage.";
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
    onRemoveSignup: (s: Session, assignmentId: string, userName: string | null) =>
      setModal({ kind: "remove-signup", session: s, signup: { assignmentId, userName } }),
    currentUserId,
    isHostManager,
    coverageCopy,
    isManager,
    teamMembers,
    onAssign: assignMember,
    allowsMultipleAssignments,
    canClaim,
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
          hubName={hubName}
          hostsSessions={hostsSessions}
          allowsMultipleAssignments={allowsMultipleAssignments}
          onScheduleStale={() => loadMonth(year, month)}
        />
      )}

      {/* Schedule view — hidden when rotations is active */}
      {view === "schedule" && <>

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

        {/* Member-picker pill — defaults to the signed-in person, can switch
            to any teammate. The visible label keeps its purpose clear instead
            of relying on the caret alone. */}
        <div className="hs-member-filter" ref={memberPillRef}>
          <span className="hs-member-filter__label">View</span>
          <div className="hs-filter-group">
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
                ? "My schedule"
                : (teamMembers.find(m => m.id === selectedMemberId)?.displayName ?? "Member")}
            </span>
            <span className="hs-filter__count">{counts.mine}</span>
          </button>
          <button
            ref={memberCaretRef}
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
                My schedule
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
                    kind={rowKind(s, currentUserId, allowsMultipleAssignments)}
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
                Earlier this month: {pastSessions.length}{" "}
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
                          kind={rowKind(s, currentUserId, allowsMultipleAssignments)}
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
        error={modalError}
        coverageCopy={coverageCopy}
        signup={modal.signup ?? null}
      />

      <ActionNotice notice={toast} onClose={() => setToast(null)} />

      </> /* end schedule view */}
    </div>
  );
}
