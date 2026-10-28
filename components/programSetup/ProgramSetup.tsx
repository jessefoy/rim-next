"use client";

/**
 * Setting up a program, step by step (2026-10-28, Phase 2). One question at a
 * time, in the order a person decides; the answers build up beside it (the
 * trail), and any answer can be gone back to. It's a draft the whole way,
 * saved as the person goes: nothing is a program, and no team is told, until
 * Publish. The questions and their rules are lib/programSetup.ts; the design
 * is mockups/program-setup-2026-10-28/.
 *
 * CSS prefix: ps-
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { RimTiptapEditor } from "@/components/registrar/program-editor/shared";
import type { RegistrationField } from "@/lib/programTypes";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";
import {
  DAY_NAMES, FORMAT_NAMES, SETUP_SECTIONS, applySchedule, fmtLong, fmtShort, inPerson, lengthWords,
  liveSteps, minutesBetween, missingForPublish, online, patternFits, patternWords, registers, repeats,
  scheduleOf, scheduleSentence, sessionDays, setupToBody, slugFor,
  type Often, type SetupChoices, type SetupData, type SetupSection, type SetupStep,
} from "@/lib/programSetup";
import { orderKey } from "@/lib/programOrder";
import { editorFieldValue } from "@/lib/programEditorData";
import { isOccurrenceOnDate } from "@/lib/scheduleUtils";

export interface SetupTeam { slug: string; name: string; formats: string[] }
export interface ListedProgram { name: string; category: string; key: string; when: string }

/** What the save answered, for the program's page to say. */
export type SaveAnswer = Record<string, unknown>;

/** Changing one section of a published program (Phase 3). */
export interface EditSection {
  slug: string;
  section: SetupSection;
  /** Closed: with the save's answer when it saved, or nothing. */
  onClose: (saved?: SaveAnswer) => void;
}

interface Props {
  /** A draft being set up; or, with `edit`, a published program's section. */
  draftId?: string;
  edit?: EditSection;
  initial: SetupData;
  teams: { hosting: SetupTeam[]; supporting: SetupTeam[]; prepare: { id: string; slug: string; name: string }[] };
  canDecideAskers: boolean;
  /** The programs already listed, by section, for "it'll be listed here". */
  listed: ListedProgram[];
  /** Today, "YYYY-MM-DD", Central. */
  today: string;
  startedAs?: string | null;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/** Monday first, as on This Week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CATEGORIES: [string, string, string][] = [
  ["FOUNDATIONS", "Foundations", "Where people begin."],
  ["ONGOING_LEARNING_PRACTICE", "Ongoing Learning & Practice", "Drop-ins and classes that go on."],
  ["IMMERSION", "Immersion", "Courses, days of mindfulness, retreats."],
  ["COMMUNITY_GROUP", "Community Group", "Member-led groups."],
  ["SPECIAL_EVENT", "Special Event", ""],
  ["SERVICE", "Service", "Internal: never listed."],
  ["PRIVATE", "Private", "Internal: never listed."],
];
const SECTION_TITLE: Record<string, string> = {
  FOUNDATIONS: "Foundations", ONGOING_LEARNING_PRACTICE: "Ongoing Learning & Practice", IMMERSION: "Immersion",
  COMMUNITY_GROUP: "Community Groups", SPECIAL_EVENT: "Special Events",
};
const DANA_TEMPLATES: [string, string][] = [
  ["General support", "<p>Your dana makes this program possible. RIM is supported entirely by the generosity of our community. Every amount is welcome.</p>"],
  ["Reciprocity", "<p>This is an old practice of reciprocity: the teachings are offered freely, and we give back as we are able. All amounts are welcome.</p>"],
  ["No one turned away", "<p>We offer this program on a sliding scale so it is accessible to everyone. Please offer an amount that reflects both your means and your appreciation for the teaching. No one is turned away for lack of funds.</p>"],
];
const KINDS: [RegistrationField["fieldType"], string][] = [
  ["shortText", "A short answer"], ["longText", "A longer answer"], ["yesNo", "Yes or no"], ["select", "A choice"],
];

const html = (v: unknown) => (typeof v === "string" ? v : v ? (isHtmlString(v) ? String(v) : renderBlockNoteHtml(v)) : "");
const firstDay = (d: SetupData) => (d.startDatetime ? d.startDatetime.slice(0, 10) : "");
const lastDay = (d: SetupData) => (d.endDatetime ? d.endDatetime.slice(0, 10) : "");
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
};
/** Is the pattern chosen enough to pick a first session? */
const patternReady = (d: SetupData) =>
  d.setup.often === "monthly" ? d.setup.monthWeek != null && d.setup.monthDay != null : d.recurrenceDays.length > 0;

// ─── Small pieces ──────────────────────────────────────────────────────────

function Choice({ name, checked, onPick, title, line, disabled }: { name: string; checked: boolean; onPick: () => void; title: string; line?: string; disabled?: boolean }) {
  return (
    <label className={`ps-choice${disabled ? " ps-choice--off" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onPick} disabled={disabled} />
      <span className="ps-choice__text"><strong>{title}</strong>{line && <span>{line}</span>}</span>
    </label>
  );
}

function Check({ checked, onChange, title, line, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; line?: string; disabled?: boolean }) {
  return (
    <label className="ps-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span><strong>{title}</strong>{line && <span className="ps-hint">{line}</span>}</span>
    </label>
  );
}

function TimePick({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [h24, m] = (value || "19:00").split(":").map(Number);
  const ap = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  const put = (nh: number, nm: number, nap: string) => onChange(`${String((nh % 12) + (nap === "PM" ? 12 : 0)).padStart(2, "0")}:${String(nm).padStart(2, "0")}`);
  return (
    <fieldset className="ps-time">
      <legend className="ps-label">{label}</legend>
      <div className="ps-row">
        <select aria-label={`${label}: hour`} value={h} onChange={(e) => put(Number(e.target.value), m, ap)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select aria-label={`${label}: minutes`} value={m} onChange={(e) => put(h, Number(e.target.value), ap)}>
          {Array.from(new Set([0, 15, 30, 45, m])).sort((a, b) => a - b).map((x) => <option key={x} value={x}>{String(x).padStart(2, "0")}</option>)}
        </select>
        <select aria-label={`${label}: morning or afternoon`} value={ap} onChange={(e) => put(h, m, e.target.value)}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
    </fieldset>
  );
}

/** A month to choose a day from: only the days `ok` allows can be chosen. */
function Calendar({ label, value, ok, start, onPick, foot }: { label: string; value: string; ok: (ymd: string) => boolean; start: string; onPick: (ymd: string) => void; foot?: string }) {
  const [view, setView] = useState((value || start).slice(0, 7));
  const [y, mo] = view.split("-").map(Number);
  const lead = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${view}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div className="ps-field">
      <span className="ps-label">{label}</span>
      <div className="ps-cal">
        <div className="ps-cal__head">
          <button type="button" className="ps-cal__nav" onClick={() => setView(addMonths(view, -1))} aria-label="Previous month">&larr;</button>
          <strong>{MONTHS[mo - 1]} {y}</strong>
          <button type="button" className="ps-cal__nav" onClick={() => setView(addMonths(view, 1))} aria-label="Next month">&rarr;</button>
        </div>
        <div className="ps-cal__grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((x, i) => <span key={i} className="ps-cal__dow" aria-hidden="true">{x}</span>)}
          {cells.map((ymd, i) => {
            if (!ymd) return <span key={i} />;
            const can = ok(ymd);
            const on = value === ymd;
            return (
              <button
                key={ymd}
                type="button"
                className={`ps-cal__day${can ? " ps-cal__day--ok" : ""}${on ? " ps-cal__day--on" : ""}`}
                disabled={!can}
                aria-pressed={on}
                aria-label={can ? fmtLong(ymd) : `${fmtLong(ymd)}, can't be chosen`}
                onClick={() => onPick(ymd)}
              >
                {Number(ymd.slice(8, 10))}
              </button>
            );
          })}
        </div>
        {foot && <p className="ps-cal__foot">{foot}</p>}
      </div>
    </div>
  );
}

function Note({ children, look }: { children: React.ReactNode; look?: boolean }) {
  return <div className={`ps-note${look ? " ps-note--look" : ""}`} role="status">{children}</div>;
}

/** What the schedule makes: its sentence and its dates. */
function Sessions({ d }: { d: SetupData }) {
  const sentence = scheduleSentence(d);
  if (!sentence) return null;
  const all = sessionDays(d);
  const bounded = repeats(d) && (d.setup.ends === "count" || d.setup.ends === "date");
  const shown = all.slice(0, 8);
  return (
    <div className="ps-result" aria-live="polite">
      <p className="ps-result__label">What you&rsquo;ve set up</p>
      <p className="ps-result__sentence">{sentence}{bounded && all.length ? ` ${all.length} session${all.length === 1 ? "" : "s"}.` : ""}</p>
      {(repeats(d) || d.setup.often === "days") && shown.length > 0 && (
        <ul className="ps-result__dates">
          {d.setup.often === "days" ? <li>{fmtShort(firstDay(d))} to {fmtShort(lastDay(d))}</li> : shown.map((x) => <li key={x}>{fmtShort(x)}</li>)}
        </ul>
      )}
      {repeats(d) && (
        <p className="ps-result__more">
          {d.setup.ends === "never" ? "It goes on until someone sets an end."
            : !bounded ? "Next, you'll say when it ends."
            : all.length > shown.length ? `And ${all.length - shown.length} more, to ${fmtLong(all[all.length - 1])}.` : ""}
        </p>
      )}
    </div>
  );
}

// ─── The walk-through ──────────────────────────────────────────────────────

export default function ProgramSetup({ draftId, edit, initial: given, teams, canDecideAskers, listed, today, startedAs = null }: Props) {
  const router = useRouter();
  // Changing a section starts on its first question, with its answers reached.
  // Frozen as it opens, so the "before" of a change and what's on screen
  // always come from the same program (a refresh can't shift one alone).
  const [initial] = useState<SetupData>(() => {
    if (!edit) return given;
    const mine = liveSteps(given, edit.section);
    return { ...given, setup: { ...given.setup, at: mine[0]?.id ?? "name", seen: mine.map((x) => x.id), redo: {} } };
  });
  const [d, setD] = useState<SetupData>(initial);
  const [view, setView] = useState<"walk" | "review" | "confirm">(!edit && initial.setup.at === "review" ? "review" : "walk");
  const [preview, setPreview] = useState<{ effects: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [problem, setProblem] = useState("");
  const [changeMsg, setChangeMsg] = useState("");
  const [fromReview, setFromReview] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [homeFromOpen, setHomeFromOpen] = useState(!!initial.dashboardShowAt);
  const [trailOpen, setTrailOpen] = useState(true);
  const [danaKey, setDanaKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // On a phone the trail starts folded, above the question.
  useEffect(() => { if (window.innerWidth <= 1000) setTrailOpen(false); }, []);
  const firstRender = useRef(true);

  const steps = useMemo(() => {
    const mine = liveSteps(d, edit?.section);
    // Changing to in person or online can leave the hosting team unable to
    // staff it: then its question joins this change.
    if (edit?.section === "when" && online(d) && d.setup.host == null) {
      const host = liveSteps(d, "teams").find((x) => x.id === "host");
      if (host) mine.push(host);
    }
    return mine;
  }, [d, edit]);
  const step: SetupStep = steps.find((s) => s.id === d.setup.at) ?? steps[0];
  const idx = steps.indexOf(step);

  // Saved as you go: a moment after each change. Leaving before that moment
  // still saves (keepalive), so the last change isn't lost.
  const latest = useRef(d);
  const pending = useRef(false);
  latest.current = d;
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      pending.current = false;
      fetch(`/api/program-drafts/${draftId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: latest.current }), keepalive: true }).catch(() => {});
    };
    if (!draftId) return;
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [draftId]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    // A published program's change is saved only after "Before you save".
    if (!draftId) return;
    pending.current = true;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        pending.current = false;
        const res = await fetch(`/api/program-drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: d }),
        });
        if (!res.ok) pending.current = true;
        setSaveState(res.ok ? "saved" : "failed");
      } catch {
        setSaveState("failed");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [d, draftId]);

  const set = useCallback((patch: Partial<SetupData>) => { setD((p) => ({ ...p, ...patch })); setProblem(""); }, []);
  const setS = useCallback((patch: Partial<SetupChoices>) => { setD((p) => ({ ...p, setup: { ...p.setup, ...patch } })); setProblem(""); }, []);

  /**
   * A change to when it meets: keep what still fits, ask again for what
   * doesn't, and say so; then put the choices into the program's values.
   */
  function changeSchedule(patch: Partial<SetupData>, choices: Partial<SetupChoices> = {}, opts: { lastDay?: string } = {}) {
    const before = d;
    let next: SetupData = { ...d, ...patch, setup: { ...d.setup, ...choices } };
    const msgs: string[] = [];
    const redo = { ...(next.setup.redo ?? {}) };
    // From weekly to monthly, the day carries over; and back.
    if (choices.often === "monthly" && next.setup.monthDay == null && next.recurrenceDays.length) {
      next.setup.monthDay = DAY_CODES.indexOf(next.recurrenceDays[0]);
      msgs.push(`It still meets on a ${DAY_NAMES[next.setup.monthDay]}. Choose which one of the month.`);
    }
    if ((choices.often === "weekly" || choices.often === "biweekly") && !next.recurrenceDays.length && next.setup.monthDay != null) {
      next.recurrenceDays = [DAY_CODES[next.setup.monthDay]];
    }
    const first = firstDay(next);
    if (first && repeats(next) && patternReady(next) && !patternFits(next.setup, next.recurrenceDays, first)) {
      msgs.push(`The first session was ${fmtLong(first)}, which doesn't fit now, so you'll choose it again.`);
      redo.first = `Was ${fmtShort(first)}. Choose it again.`;
      next.startDatetime = "";
    }
    if (next.recurrenceUntil && (!firstDay(next) || next.recurrenceUntil < firstDay(next) || (patternReady(next) && !patternFits(next.setup, next.recurrenceDays, next.recurrenceUntil)))) {
      redo.ends = `The last session was ${fmtShort(next.recurrenceUntil)}. Choose it again.`;
      next.recurrenceUntil = "";
    }
    if (firstDay(next)) delete redo.first;
    if (next.recurrenceUntil || next.setup.ends !== "date") delete redo.ends;
    next.setup.redo = redo;
    next = applySchedule(next, opts.lastDay);
    if (choices.often && before.setup.often && before.setup.often !== choices.often && (before.setup.timeFrom || before.setup.timeTo)) msgs.push("The time is kept.");
    setChangeMsg(msgs.join(" "));
    setProblem("");
    setD(next);
  }

  /** In person, online or both: a hosting team that doesn't staff the new
   *  format is asked for again, rather than refused at Publish. */
  function setFormat(format: string) {
    const team = d.hostingHubSlug || "host-team";
    const staffs = teams.hosting.some((t) => t.slug === team && t.formats.includes(format));
    const stillHosts = d.setup.host !== "team" || staffs || format === "in-person";
    setD((p) => ({
      ...p,
      programFormat: format,
      hostingHubSlug: stillHosts ? p.hostingHubSlug : null,
      setup: { ...p.setup, host: stillHosts ? p.setup.host : null, redo: stillHosts ? p.setup.redo : { ...(p.setup.redo ?? {}), host: "The team chosen doesn't staff this. Choose again." } },
    }));
    setProblem("");
  }

  function go(id: string, review = false) {
    setChangeMsg("");
    setProblem("");
    setFromReview(review);
    setView("walk");
    // The step left and the step arrived at are both reached.
    setD((p) => ({ ...p, setup: { ...p.setup, at: id, seen: Array.from(new Set([...p.setup.seen, p.setup.at, id])).filter((x) => x !== "review") } }));
  }
  useEffect(() => {
    if (view === "walk") headingRef.current?.focus({ preventScroll: true });
    if (typeof window !== "undefined" && window.innerWidth <= 1000) window.scrollTo({ top: 0 });
  }, [d.setup.at, view]);

  function next(skip = false) {
    const need = !skip && step.need?.(d);
    if (need) { setProblem(need); return; }
    if (edit && idx === steps.length - 1) { void seeWhatChanges(); return; }
    if (fromReview || idx === steps.length - 1) {
      setFromReview(false);
      setChangeMsg("");
      setView("review");
      setD((p) => ({ ...p, setup: { ...p.setup, at: "review", seen: Array.from(new Set([...p.setup.seen, step.id])).filter((x) => x !== "review") } }));
      window.scrollTo({ top: 0 });
      return;
    }
    go(steps[idx + 1].id);
  }

  // ── Changing a published program: what changed, what it does, then save ──
  const hostingTeams = teams.hosting.filter((t) => t.formats.includes(d.programFormat)).map((t) => t.slug);
  const supportingTeams = teams.supporting.filter((t) => t.formats.includes(d.programFormat)).map((t) => t.slug);
  /** The save's body: only what changed, with each one as it was (a safe save). */
  function changedBody(): Record<string, unknown> {
    // The teams as stored on one side and as they can staff it now on the
    // other, so a team that can't staff a new format is taken off.
    const before: Record<string, unknown> = { ...setupToBody(initial, { hostingTeams, supportingTeams: teams.supporting.map((t) => t.slug) }), slug: initial.slug };
    const after: Record<string, unknown> = { ...setupToBody(d, { hostingTeams, supportingTeams }), slug: initial.slug };
    // Kept as stored, never wiped by a change elsewhere: registration's
    // settings and questions when people stop registering (switching back
    // finds them), and an outside meeting link when it stops meeting online.
    const keep = [
      ...(!d.registrationEnabled ? ["registrationFields", "registrationCapacity", "registrationDeadline", "registrationOpensAt", "reminderDate", "reminderDaysBefore", "followUpEnabled"] : []),
      ...(!online(d) ? ["outsideMeetingUrl", "outsideMeetingPublic", "recordByDefault", "isOpenAccess", "hostingHubSlug"] : []),
    ];
    for (const k of keep) { delete before[k]; delete after[k]; }
    const keys = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    const body: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, after[k]]));
    body._base = Object.fromEntries(keys.map((k) => [k, editorFieldValue(initial, k) ?? null]));
    return body;
  }
  /** The first question in this change still missing something, if any. */
  function firstGap(): { id: string; need: string } | null {
    for (const st of steps) {
      const need = st.need?.(d);
      if (need) return { id: st.id, need };
    }
    return null;
  }
  async function seeWhatChanges() {
    setSaveError("");
    const gap = firstGap();
    if (gap) { go(gap.id); setProblem(gap.need); return; }
    const body = changedBody();
    if (Object.keys(body).length === 1) { setPreview({ effects: ["Nothing has changed here."] }); setView("confirm"); return; }
    setPreview(null);
    setView("confirm");
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch(`/api/programs-pg/${edit!.slug}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(answer.error || "We couldn't work out what this changes. Please try again."); setPreview({ effects: [] }); return; }
      setPreview({ effects: answer.effects ?? [] });
    } catch {
      setSaveError("We couldn't reach the site. Check your connection and try again.");
      setPreview({ effects: [] });
    }
  }
  async function saveChange() {
    const gap = firstGap();
    if (gap) { go(gap.id); setProblem(gap.need); return; }
    const body = changedBody();
    if (Object.keys(body).length === 1) { edit!.onClose(); return; }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/programs-pg/${edit!.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(answer.error || "It wasn't saved. Please try again."); setSaving(false); return; }
      edit!.onClose(answer);
    } catch {
      setSaveError("We couldn't reach the site, so it wasn't saved. Check your connection and try again.");
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError("");
    try {
      // What's on screen goes with it, so what's published is what the review shows.
      const res = await fetch(`/api/program-drafts/${draftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: d }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setPublishError(body.error || "It wasn't published. Please try again."); setPublishing(false); return; }
      try {
        sessionStorage.setItem(`pe-created:${body.slug}`, "1");
        if (Array.isArray(body.seatConflicts) && body.seatConflicts.length) sessionStorage.setItem(`pe-seat-conflicts:${body.slug}`, JSON.stringify(body.seatConflicts));
      } catch { /* the program's page opening says enough */ }
      router.push(`/tools/programs/${body.slug}/edit`);
    } catch {
      setPublishError("We couldn't reach the site, so it wasn't published. Check your connection and try again.");
      setPublishing(false);
    }
  }

  async function discard() {
    await fetch(`/api/program-drafts/${draftId}`, { method: "DELETE" }).catch(() => {});
    router.push("/tools/programs");
  }

  // Teacher search, a moment after typing.
  useEffect(() => {
    if (!teacherQuery.trim()) { setTeacherResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(teacherQuery)}`);
        if (res.ok) setTeacherResults(await res.json());
      } catch { /* nothing found is said below */ }
    }, 300);
    return () => clearTimeout(t);
  }, [teacherQuery]);

  async function addImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload" });
      set({ programImage: blob.url });
    } catch (err) {
      setProblem(err instanceof Error ? `The picture wasn't added: ${err.message}` : "The picture wasn't added. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Each question's controls ──
  function body(st: SetupStep): React.ReactNode {
    const s = d.setup;
    switch (st.id) {
      case "name":
        return (
          <>
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-name">Name</label>
              <input id="ps-name" className="ps-input" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mindful Photography" />
            </div>
            <p className="ps-hint">It appears on the public site, on My Home and in every email. {edit ? "Its address stays: " : "Its address: "}rootedinmindfulness.org/programs/<strong>{edit ? initial.slug : slugFor(d) || "…"}</strong></p>
          </>
        );
      case "line":
        return (
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-line">One line</label>
            <p className="ps-hint">It sits under the name on Programs &amp; Events.</p>
            <input id="ps-line" className="ps-input" value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </div>
        );
      case "describe":
        return (
          <>
            <div className="ps-field">
              <span className="ps-label">Description</span>
              <p className="ps-hint">This is the program&rsquo;s page. Write for someone who has never been to RIM.</p>
              <RimTiptapEditor value={html(d.description)} onChange={(v) => set({ description: v })} placeholder="What happens, who it's for, what someone will take away." variant="document" />
            </div>
            <div className="ps-field">
              <span className="ps-label">A picture, if you have one</span>
              <p className="ps-hint">It sits at the top of the page. A wide one works best.</p>
              {d.programImage && (
                <div className="ps-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.programImage} alt="" className="ps-thumb" />
                  <button type="button" className="app-act" onClick={() => set({ programImage: "" })}>Remove the picture</button>
                </div>
              )}
              <label className="app-act ps-file">
                {uploading ? "Adding the picture…" : d.programImage ? "Choose another picture" : "Choose a picture"}
                <input type="file" accept="image/*" onChange={addImage} disabled={uploading} />
              </label>
            </div>
          </>
        );
      case "extras":
        return (
          <>
            <p className="ps-hint">All of this is optional. Leave it empty and the page opens straight onto the description.</p>
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-quote">A short quote at the top</label>
              <input id="ps-quote" className="ps-input" value={d.pullQuote} onChange={(e) => set({ pullQuote: e.target.value })} />
            </div>
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-quote-by">Who said it</label>
              <input id="ps-quote-by" className="ps-input" value={d.pullQuoteSource} onChange={(e) => set({ pullQuoteSource: e.target.value })} disabled={!d.pullQuote.trim() && !d.pullQuoteSource} />
            </div>
            <div className="ps-field">
              <span className="ps-label">Notes for the page</span>
              <p className="ps-hint">Scheduling context, accessibility, background.</p>
              <RimTiptapEditor value={html(d.programNotes)} onChange={(v) => set({ programNotes: v })} variant="message" />
            </div>
          </>
        );
      case "where":
        return (
          <div className="ps-choices">
            <Choice name="where" checked={d.programFormat === "in-person"} onPick={() => setFormat("in-person")} title="In person" line="At RIM or another place." />
            <Choice name="where" checked={d.programFormat === "virtual"} onPick={() => setFormat("virtual")} title="Online" line="People join from My Home or its page." />
            <Choice name="where" checked={d.programFormat === "hybrid"} onPick={() => setFormat("hybrid")} title="Both" line="In person, and online at the same time." />
          </div>
        );
      case "place":
        return (
          <>
            <div className="ps-choices">
              <Choice name="venue" checked={d.venue !== "other"} onPick={() => set({ venue: "at-rim" })} title="At RIM" line="The center's address goes on the page and in emails." />
              <Choice name="venue" checked={d.venue === "other"} onPick={() => set({ venue: "other" })} title="Somewhere else" />
            </div>
            {d.venue === "other" && (
              <>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-place">The place and its address</label>
                  <input id="ps-place" className="ps-input" value={d.locationText} onChange={(e) => set({ locationText: e.target.value })} />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-map">A map link, if you have one</label>
                  <p className="ps-hint">It shows as &ldquo;Map and directions&rdquo; in the confirmation email.</p>
                  <input id="ps-map" className="ps-input" value={d.locationLink} onChange={(e) => set({ locationLink: e.target.value })} placeholder="https://…" />
                </div>
              </>
            )}
          </>
        );
      case "room":
        return (
          <>
            <div className="ps-choices">
              <Choice name="room" checked={s.room === "rim"} onPick={() => setS({ room: "rim" })} title="RIM's Zoom" line="RIM opens a meeting for each session. Most programs use this." />
              <Choice name="room" checked={s.room === "outside"} onPick={() => setS({ room: "outside" })} title="Someone else's meeting" line="Like Recovery Dharma's own room. People still join through RIM, at session times." />
            </div>
            {s.room === "outside" ? (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-outside">The meeting link</label>
                <p className="ps-hint">Paste the whole link, passcode and all.</p>
                <input id="ps-outside" className="ps-input" value={d.outsideMeetingUrl ?? ""} onChange={(e) => set({ outsideMeetingUrl: e.target.value })} placeholder="https://us06web.zoom.us/j/…" />
              </div>
            ) : (
              <Check checked={!!d.recordByDefault} onChange={(v) => set({ recordByDefault: v })} title="Record the sessions" line="Audio only, for RIM's use. People see Zoom's recording mark." />
            )}
          </>
        );
      case "often":
        return (
          <div className="ps-choices">
            {([
              ["once", "Once", "One day."], ["days", "Several days in a row", "A retreat or a weekend."], ["weekly", "Every week", "On one day or more."],
              ["biweekly", "Every other week", ""], ["monthly", "Once a month", "Like the last Sunday of each month."],
            ] as [Often, string, string][]).map(([v, t, l]) => (
              <Choice key={v} name="often" checked={s.often === v} onPick={() => changeSchedule({}, { often: v })} title={t} line={l} />
            ))}
          </div>
        );
      case "days":
        return s.often === "monthly" ? (
          <>
            <fieldset className="ps-field">
              <legend className="ps-label">Which one</legend>
              <div className="ps-days ps-days--five">
                {([1, 2, 3, 4, "last"] as const).map((w) => (
                  <label key={w} className="ps-day"><input type="radio" name="monthWeek" checked={s.monthWeek === w} onChange={() => changeSchedule({}, { monthWeek: w })} />{w === "last" ? "Last" : ["", "1st", "2nd", "3rd", "4th"][w]}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="ps-field">
              <legend className="ps-label">Which day</legend>
              <div className="ps-days">
                {WEEK.map((wd) => (
                  <label key={wd} className="ps-day"><input type="radio" name="monthDay" checked={s.monthDay === wd} onChange={() => changeSchedule({}, { monthDay: wd })} />{DAY_NAMES[wd].slice(0, 3)}</label>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <fieldset className="ps-field">
            <legend className="ps-sr">Days it meets</legend>
            <div className="ps-days">
              {WEEK.map((wd) => {
                const code = DAY_CODES[wd];
                const on = d.recurrenceDays.includes(code);
                return (
                  <label key={wd} className="ps-day">
                    <input type="checkbox" checked={on} onChange={() => changeSchedule({ recurrenceDays: on ? d.recurrenceDays.filter((x) => x !== code) : [...d.recurrenceDays, code] })} />
                    {DAY_NAMES[wd].slice(0, 3)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      case "time": {
        const mins = minutesBetween(s.timeFrom, s.timeTo);
        return (
          <>
            <div className="ps-row ps-row--top">
              <TimePick label={s.often === "days" ? "Begins on the first day at" : "From"} value={s.timeFrom} onChange={(v) => changeSchedule({}, { timeFrom: v })} />
              <TimePick label={s.often === "days" ? "Ends on the last day at" : "To"} value={s.timeTo} onChange={(v) => changeSchedule({}, { timeTo: v })} />
            </div>
            {s.often !== "days" && mins != null && mins > 0 && <p className="ps-hint" aria-live="polite">That&rsquo;s <strong>{lengthWords(mins)}</strong>.</p>}
          </>
        );
      }
      case "first": {
        const fits = (ymd: string) => ymd >= today && (repeats(d) ? patternFits(s, d.recurrenceDays, ymd) : true);
        const pattern = patternWords(d);
        return (
          <>
            <div className="ps-row ps-row--top">
              <Calendar
                key={`first-${s.often}`}
                label={s.often === "once" ? "The day" : s.often === "days" ? "First day" : "First session"}
                value={firstDay(d)}
                start={today}
                ok={fits}
                foot={repeats(d) && pattern ? `Only the days it meets can be chosen: ${pattern}.${s.often === "monthly" && s.monthWeek === 4 ? " The first one is in a month with five, so it's read as the 4th, not the last." : ""}` : undefined}
                onPick={(ymd) => changeSchedule({ startDatetime: `${ymd}T${s.timeFrom}` }, {}, s.often === "days" && lastDay(d) <= ymd ? { lastDay: "" } : {})}
              />
              {s.often === "days" && firstDay(d) && (
                <Calendar
                  key={`last-${firstDay(d)}`}
                  label="Last day"
                  value={lastDay(d) > firstDay(d) ? lastDay(d) : ""}
                  start={firstDay(d)}
                  ok={(ymd) => ymd > firstDay(d)}
                  onPick={(ymd) => changeSchedule({}, {}, { lastDay: ymd })}
                />
              )}
            </div>
            <Sessions d={d} />
          </>
        );
      }
      case "ends":
        return (
          <>
            <div className="ps-choices">
              <Choice name="ends" checked={s.ends === "never"} onPick={() => changeSchedule({}, { ends: "never" })} title="It goes on" line="No end for now. You can set one later." />
              <Choice name="ends" checked={s.ends === "count"} onPick={() => changeSchedule({ recurrenceCount: d.recurrenceCount || "4" }, { ends: "count" })} title="After a number of sessions" />
              <Choice name="ends" checked={s.ends === "date"} onPick={() => changeSchedule({}, { ends: "date" })} title="On a date" />
            </div>
            {s.ends === "count" && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-count">How many sessions</label>
                <input id="ps-count" className="ps-input ps-input--short" type="number" min={2} max={200} inputMode="numeric" value={d.recurrenceCount} onChange={(e) => changeSchedule({ recurrenceCount: e.target.value })} />
              </div>
            )}
            {s.ends === "date" && (
              <Calendar
                label="Last session"
                value={d.recurrenceUntil}
                start={firstDay(d) || today}
                ok={(ymd) => !!firstDay(d) && ymd >= firstDay(d) && isOccurrenceOnDate({ ...scheduleOf(d), recurrenceCount: null, recurrenceUntil: null }, ymd)}
                onPick={(ymd) => changeSchedule({ recurrenceUntil: ymd })}
              />
            )}
            <Sessions d={d} />
          </>
        );
      case "daynote":
        return (
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-daynote">The line</label>
            <p className="ps-hint">One quiet line shown with the session on My Home on the day. Leave it empty if there&rsquo;s nothing to say.</p>
            <input id="ps-daynote" className="ps-input" value={d.earlyArrivalMessage} onChange={(e) => set({ earlyArrivalMessage: e.target.value })} placeholder="Held in noble silence before and during the session." />
          </div>
        );
      case "teachers":
        return (
          <>
            {d.programTeachers.length > 0 && (
              <ul className="ps-tags">
                {d.programTeachers.map((t) => (
                  <li key={t.id}>{t.firstName} {t.lastName} <button type="button" className="app-act" onClick={() => set({ programTeachers: d.programTeachers.filter((x) => x.id !== t.id) })} aria-label={`Take off ${t.firstName} ${t.lastName}`}>Take off</button></li>
                ))}
              </ul>
            )}
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-teacher">Find a teacher</label>
              <input id="ps-teacher" className="ps-input" value={teacherQuery} onChange={(e) => setTeacherQuery(e.target.value)} placeholder="Type a name" autoComplete="off" />
            </div>
            {teacherResults.filter((t) => !d.programTeachers.some((x) => x.id === t.id)).length > 0 && (
              <ul className="ps-pick">
                {teacherResults.filter((t) => !d.programTeachers.some((x) => x.id === t.id)).map((t) => (
                  <li key={t.id}><button type="button" className="app-act" onClick={() => { set({ programTeachers: [...d.programTeachers, t] }); setS({ noTeacher: false }); setTeacherQuery(""); }}>Add {t.firstName} {t.lastName}</button></li>
                ))}
              </ul>
            )}
            <p className="ps-hint">Teachers can take host controls in Zoom if needed.</p>
            <Check checked={s.noTeacher} onChange={(v) => { setS({ noTeacher: v }); if (v) set({ programTeachers: [] }); }} title="No teacher for this one" line="A peer-led sit or a community group." />
          </>
        );
      case "host": {
        const hosting = teams.hosting.filter((t) => t.formats.includes(d.programFormat));
        return (
          <>
            <div className="ps-choices">
              {hosting.map((t) => (
                <Choice key={t.slug} name="host" checked={s.host === "team" && (d.hostingHubSlug || "host-team") === t.slug} onPick={() => { setS({ host: "team", redo: { ...(s.redo ?? {}), host: "" } }); set({ hostingHubSlug: t.slug === "host-team" ? null : t.slug, hostingRequired: true }); }} title={`Yes, the ${t.name}`} line="They take each session and open the room." />
              ))}
              <Choice name="host" checked={s.host === "none"} onPick={() => { setS({ host: "none", redo: { ...(s.redo ?? {}), host: "" } }); set({ hostingRequired: false }); }} title="No host needed" line="It's self-led. The room still opens at session times." />
            </div>
            <Note><p>The team hears about it when you publish, not before.</p></Note>
          </>
        );
      }
      case "support": {
        const supporting = teams.supporting.filter((t) => t.formats.includes(d.programFormat));
        if (!supporting.length) return <p className="ps-hint">No team helps at {d.programFormat === "virtual" ? "online" : "in-person"} sessions yet.</p>;
        return (
          <>
            <div className="ps-choices ps-choices--two">
              {supporting.map((t) => {
                const on = (d.coverageHubSlugs ?? []).includes(t.slug);
                return <Check key={t.slug} checked={on} onChange={(v) => set({ coverageHubSlugs: v ? [...(d.coverageHubSlugs ?? []), t.slug] : (d.coverageHubSlugs ?? []).filter((x) => x !== t.slug) })} title={t.name} line="Signs up for sessions in its own Scheduler." />;
              })}
            </div>
            <Note><p>Each team hears about it when you publish, not before.</p></Note>
          </>
        );
      }
      case "prepare":
        if (!canDecideAskers) return <Note><p>The registration team chooses these, since a team that prepares sees who&rsquo;s coming.</p></Note>;
        if (!teams.prepare.length) return <p className="ps-hint">No team has Helping with yet. An admin can add it to a team&rsquo;s space.</p>;
        return (
          <>
            <p className="ps-hint">Like the kitchen. They see how many are coming and the answers to their own questions. Never dana.</p>
            {teams.prepare.map((t) => {
              const h = (d.helperTeams ?? []).find((x) => x.hubId === t.id);
              return (
                <div key={t.id}>
                  <Check checked={!!h} onChange={(v) => set({ helperTeams: v ? [...(d.helperTeams ?? []), { hubId: t.id, canReach: false }] : (d.helperTeams ?? []).filter((x) => x.hubId !== t.id) })} title={t.name} />
                  {h && <div className="ps-indent"><Check checked={h.canReach} onChange={(v) => set({ helperTeams: (d.helperTeams ?? []).map((x) => (x.hubId === t.id ? { ...x, canReach: v } : x)) })} title="They can reach people" line="They see each person's email and phone." /></div>}
                </div>
              );
            })}
          </>
        );
      case "join":
        return (
          <div className="ps-choices">
            <Choice name="join" checked={s.join === "come"} onPick={() => { setS({ join: "come" }); set({ openEntry: true, registrationEnabled: false }); }} title="They just come" line="Anyone signed in may join, with no sign-up. It's marked Drop-in on This Week." />
            <Choice name="join" checked={s.join === "register"} onPick={() => { setS({ join: "register" }); set({ openEntry: false, registrationEnabled: true, outsideMeetingPublic: false }); }} title="They register first" line="Each person signs up and gets a place." />
            <Choice name="join" checked={s.join === "both"} onPick={() => { setS({ join: "both" }); set({ openEntry: true, registrationEnabled: true, outsideMeetingPublic: false }); }} title="Both" line="People can register, and anyone signed in may also just come." />
          </div>
        );
      case "guests": {
        const guests = d.outsideMeetingPublic ? "page" : d.isOpenAccess ? "link" : "no";
        return (
          <div className="ps-choices">
            <Choice name="guests" checked={guests === "no"} onPick={() => set({ isOpenAccess: false, outsideMeetingPublic: false })} title="Only people with a RIM account" />
            <Choice name="guests" checked={guests === "link"} onPick={() => set({ isOpenAccess: true, outsideMeetingPublic: false })} title="Anyone with a guest link" line="A link you share. It works only around session times." />
            {s.room === "outside" && (
              <Choice name="guests" checked={guests === "page"} disabled={registers(d)} onPick={() => set({ isOpenAccess: false, outsideMeetingPublic: true })} title="Anyone, from the program's page" line={registers(d) ? "Not while people register: the page shows Register instead." : "A Join button for anyone."} />
            )}
          </div>
        );
      }
      case "opens":
        return (
          <>
            <div className="ps-choices">
              <Choice name="opens" checked={s.opens === "publish"} onPick={() => { setS({ opens: "publish" }); set({ registrationOpensAt: "" }); }} title="As soon as it's published" />
              <Choice name="opens" checked={s.opens === "date"} onPick={() => setS({ opens: "date" })} title="From a date" line="The page says when registration opens, at 9 in the morning." />
            </div>
            {s.opens === "date" && (
              <Calendar label="Registration opens on" value={d.registrationOpensAt.slice(0, 10)} start={today} ok={(ymd) => ymd > today && (!firstDay(d) || ymd <= firstDay(d))} onPick={(ymd) => set({ registrationOpensAt: `${ymd}T09:00` })} />
            )}
            <div className="ps-choices ps-gap">
              <Choice name="closes" checked={s.closes === "begins"} onPick={() => { setS({ closes: "begins" }); set({ registrationDeadline: "" }); }} title="Open until it begins" />
              <Choice name="closes" checked={s.closes === "date"} onPick={() => setS({ closes: "date" })} title="Open until a date" />
            </div>
            {s.closes === "date" && (
              <Calendar label="The last day to register" value={d.registrationDeadline.slice(0, 10)} start={today} ok={(ymd) => ymd >= today && (!d.registrationOpensAt || ymd >= d.registrationOpensAt.slice(0, 10))} onPick={(ymd) => set({ registrationDeadline: `${ymd}T23:45` })} />
            )}
          </>
        );
      case "places":
        return (
          <>
            <div className="ps-choices">
              <Choice name="limit" checked={s.limit === "none"} onPick={() => { setS({ limit: "none" }); set({ registrationCapacity: "" }); }} title="No limit" />
              <Choice name="limit" checked={s.limit === "some"} onPick={() => setS({ limit: "some" })} title="A set number" line="Once it's full, people join a waiting list." />
            </div>
            {s.limit === "some" && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-cap">Places</label>
                <input id="ps-cap" className="ps-input ps-input--short" type="number" min={1} inputMode="numeric" value={d.registrationCapacity} onChange={(e) => set({ registrationCapacity: e.target.value })} />
              </div>
            )}
          </>
        );
      case "questions": {
        const askers: [string, string][] = [["", "The registration team"]];
        if (d.programTeachers.length === 1) askers.push(["teacher", `The teacher, ${d.programTeachers[0].firstName} ${d.programTeachers[0].lastName}`]);
        else if (d.programTeachers.length > 1) askers.push(["teacher", "The teachers"]);
        for (const p of teams.prepare) if ((d.helperTeams ?? []).some((h) => h.hubId === p.id)) askers.push([`team:${p.id}`, `The ${p.name}`]);
        const put = (i: number, patch: Partial<RegistrationField>) => set({ registrationFields: d.registrationFields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
        const move = (i: number, by: number) => {
          const list = [...d.registrationFields];
          const [f] = list.splice(i, 1);
          list.splice(i + by, 0, f);
          set({ registrationFields: list });
        };
        return (
          <>
            <p className="ps-hint">Each question goes to whoever asks it, and always to the registration team.</p>
            <ol className="ps-qs">
              {d.registrationFields.map((f, i) => (
                <li key={f._key ?? i} className="ps-q">
                  <div className="ps-field">
                    <label className="ps-label" htmlFor={`ps-q-${i}`}>Question {i + 1}</label>
                    <input id={`ps-q-${i}`} className="ps-input" value={f.label} onChange={(e) => put(i, { label: e.target.value })} />
                  </div>
                  <div className="ps-row">
                    <label className="ps-field ps-field--inline">
                      <span className="ps-label">Answer</span>
                      <select value={f.fieldType} onChange={(e) => put(i, { fieldType: e.target.value as RegistrationField["fieldType"] })}>
                        {KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </label>
                    <label className="ps-field ps-field--inline">
                      <span className="ps-label">Asked by</span>
                      <select value={f.askedBy ?? ""} disabled={!canDecideAskers} onChange={(e) => put(i, { askedBy: e.target.value || undefined })}>
                        {askers.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        {f.askedBy && !askers.some(([v]) => v === f.askedBy) && <option value={f.askedBy}>The registration team, until it&rsquo;s chosen</option>}
                      </select>
                    </label>
                  </div>
                  {f.fieldType === "select" && (
                    <div className="ps-field">
                      <label className="ps-label" htmlFor={`ps-q-${i}-opts`}>The choices, separated by commas</label>
                      <input id={`ps-q-${i}-opts`} className="ps-input" value={f.options.join(", ")} onChange={(e) => put(i, { options: e.target.value.split(",").map((x) => x.trimStart()) })} onBlur={() => put(i, { options: f.options.map((x) => x.trim()).filter(Boolean) })} />
                    </div>
                  )}
                  <div className="ps-row">
                    <Check checked={f.required} onChange={(v) => put(i, { required: v })} title="Needs an answer" />
                    {i > 0 && <button type="button" className="app-act" onClick={() => move(i, -1)}>Move up</button>}
                    {i < d.registrationFields.length - 1 && <button type="button" className="app-act" onClick={() => move(i, 1)}>Move down</button>}
                    <button type="button" className="app-act app-act--danger" onClick={() => set({ registrationFields: d.registrationFields.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="app-act" onClick={() => set({ registrationFields: [...d.registrationFields, { label: "", fieldType: "shortText", required: false, options: [] }] })}>+ Add a question</button>
            {!canDecideAskers && <p className="ps-hint">The registration team chooses who asks each question, since that decides who reads the answers.</p>}
          </>
        );
      }
      case "confirm":
        return (
          <div className="ps-field">
            <span className="ps-label">The confirmation</span>
            <p className="ps-hint">It goes as soon as someone registers, with the day, the time and how to join. Add what to bring, how to prepare, or directions. To add a link, select the words, then the chain button.</p>
            <RimTiptapEditor value={html(d.confirmationMessage)} onChange={(v) => set({ confirmationMessage: v })} placeholder="What to bring, how to prepare…" variant="message" />
          </div>
        );
      case "reminder":
        return (
          <>
            <div className="ps-choices">
              <Choice name="remind" checked={s.remind === "days"} onPick={() => { setS({ remind: "days" }); set({ reminderDate: "", reminderDaysBefore: d.reminderDaysBefore || "2" }); }} title="Days before the first session" line="In the morning, and to anyone who registers later." />
              <Choice name="remind" checked={s.remind === "date"} onPick={() => { setS({ remind: "date" }); set({ reminderDaysBefore: "" }); }} title="On a set date" />
              <Choice name="remind" checked={s.remind === "none"} onPick={() => { setS({ remind: "none" }); set({ reminderDaysBefore: "", reminderDate: "" }); }} title="No reminder" />
            </div>
            {s.remind === "days" && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-days-before">Days before</label>
                <input id="ps-days-before" className="ps-input ps-input--short" type="number" min={1} max={60} value={d.reminderDaysBefore ?? ""} onChange={(e) => set({ reminderDaysBefore: e.target.value })} />
              </div>
            )}
            {s.remind === "date" && (
              <Calendar label="Send it on" value={d.reminderDate.slice(0, 10)} start={today} ok={(ymd) => ymd >= today && (!firstDay(d) || ymd <= firstDay(d))} onPick={(ymd) => set({ reminderDate: `${ymd}T09:00` })} />
            )}
            {s.remind !== "none" && (
              <div className="ps-field">
                <span className="ps-label">Anything to add to it</span>
                <RimTiptapEditor value={html(d.reminderMessage)} onChange={(v) => set({ reminderMessage: v })} placeholder="What the reminder adds…" variant="message" />
              </div>
            )}
          </>
        );
      case "after":
        return (
          <>
            <div className="ps-choices">
              <Choice name="after" checked={!d.followUpEnabled} onPick={() => set({ followUpEnabled: false })} title="No note" />
              <Choice name="after" checked={!!d.followUpEnabled} onPick={() => set({ followUpEnabled: true })} title="Yes, send a note" line="A thank-you, a reading, a word about what comes next." />
            </div>
            {d.followUpEnabled && (
              <div className="ps-field">
                <span className="ps-label">The note</span>
                <RimTiptapEditor value={html(d.followUpMessage)} onChange={(v) => set({ followUpMessage: v })} placeholder="The note…" variant="message" />
              </div>
            )}
          </>
        );
      case "dana":
        return (
          <>
            <p className="ps-hint">RIM&rsquo;s practice is voluntary dana.</p>
            <div className="ps-choices">
              <Choice name="dana" checked={d.danaMode === "none"} onPick={() => set({ danaMode: "none" })} title="No dana step" />
              <Choice name="dana" checked={d.danaMode === "voluntary"} onPick={() => set({ danaMode: "voluntary" })} title="Dana invited" line="People give what they choose. You can suggest an amount." />
              <Choice name="dana" checked={d.danaMode === "base_plus_dana"} onPick={() => set({ danaMode: "base_plus_dana" })} title="A set amount, plus dana" line="Where RIM pays for a place, like a retreat." />
              <Choice name="dana" checked={d.danaMode === "fixed"} onPick={() => set({ danaMode: "fixed" })} title="A fixed amount" line="Not RIM's usual practice." />
            </div>
            {(d.danaMode === "voluntary" || d.danaMode === "base_plus_dana") && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-suggest">Suggested amount ($)</label>
                <input id="ps-suggest" className="ps-input ps-input--short" type="number" min={0} step="0.01" value={d.suggestedDana} onChange={(e) => set({ suggestedDana: e.target.value })} />
              </div>
            )}
            {d.danaMode === "base_plus_dana" && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-base">The set amount ($)</label>
                <input id="ps-base" className="ps-input ps-input--short" type="number" min={0} step="0.01" value={d.danaBaseAmount} onChange={(e) => set({ danaBaseAmount: e.target.value })} />
              </div>
            )}
            {d.danaMode === "fixed" && (
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-fixed">The amount ($)</label>
                <input id="ps-fixed" className="ps-input ps-input--short" type="number" min={0} step="0.01" value={d.danaFixedAmount} onChange={(e) => set({ danaFixedAmount: e.target.value })} />
              </div>
            )}
          </>
        );
      case "danaWords":
        return (
          <>
            <div className="ps-field">
              <span className="ps-label">Start from</span>
              <div className="ps-row">
                {DANA_TEMPLATES.map(([t, words]) => <button key={t} type="button" className="app-act" onClick={() => { set({ danaMessage: words }); setDanaKey((k) => k + 1); }}>{t}</button>)}
              </div>
            </div>
            <div className="ps-field">
              <span className="ps-label">At the dana step</span>
              <RimTiptapEditor key={danaKey} value={html(d.danaMessage)} onChange={(v) => set({ danaMessage: v })} variant="message" />
            </div>
            <div className="ps-field">
              <label className="ps-label" htmlFor="ps-dana-note">A short note on the program&rsquo;s page</label>
              <p className="ps-hint">Near the Register button.</p>
              <input id="ps-dana-note" className="ps-input" value={d.danaText} onChange={(e) => set({ danaText: e.target.value })} />
            </div>
          </>
        );
      case "category":
        return (
          <div className="ps-choices">
            {CATEGORIES.map(([v, t, l]) => <Choice key={v} name="category" checked={d.offeringCategory === v} onPick={() => set({ offeringCategory: v })} title={t} line={l} />)}
          </div>
        );
      case "kind":
        return (
          <>
            <p className="ps-hint">A label on its card. It doesn&rsquo;t decide who can join.</p>
            <div className="ps-choices ps-choices--two">
              {Object.entries(FORMAT_NAMES).map(([v, t]) => <Choice key={v} name="kind" checked={d.offeringFormat === v} onPick={() => set({ offeringFormat: v, silentMeditation: v === "DROP_IN" ? d.silentMeditation : false })} title={t} />)}
            </div>
            {d.offeringFormat === "DROP_IN" && <Check checked={d.silentMeditation} onChange={(v) => set({ silentMeditation: v })} title="A silent sit" line="Listed under Silent meditation." />}
            <Check checked={d.hostedByVolunteers} onChange={(v) => set({ hostedByVolunteers: v })} title="Hosted by volunteers" line="Its card says so." />
          </>
        );
      case "show": {
        const never = d.offeringCategory === "PRIVATE" || d.offeringCategory === "SERVICE";
        const onList = !d.hideFromProgramPageList && !never;
        return (
          <>
            <Check checked={onList} disabled={never} onChange={(v) => set({ hideFromProgramPageList: !v })} title="On Programs & Events" line={never ? "Private and Service programs are never listed." : undefined} />
            {onList && <ListedHere d={d} listed={listed} onFirst={(v) => set({ listFirst: v })} />}
            <Check checked={!d.hideFromProgramPageList && !d.hideFromWeeklySchedule} disabled={d.hideFromProgramPageList} onChange={(v) => set({ hideFromWeeklySchedule: !v })} title="On This Week" line={d.hideFromProgramPageList ? "Off Programs & Events means off This Week too." : "In the weeks it meets, by day and time."} />
            {online(d) && (
              <>
                <Check checked={!d.removeFromProgramList || !!d.dashboardShowAt} onChange={(v) => { set({ removeFromProgramList: !v, dashboardShowAt: "" }); setHomeFromOpen(false); }} title="On My Home, on the days it meets" line={d.openEntry ? "For every member, with Join." : "For the people registered, with Join."} />
                {(!d.removeFromProgramList || d.dashboardShowAt) && (
                  <div className="ps-indent">
                    <button type="button" className="app-act" onClick={() => setHomeFromOpen(!homeFromOpen)}>
                      {d.dashboardShowAt ? `Only from ${fmtLong(d.dashboardShowAt.slice(0, 10))} · change` : "Only from a date…"}
                    </button>
                    {homeFromOpen && (
                      <Calendar label="Show it on My Home from" value={d.dashboardShowAt.slice(0, 10)} start={today} ok={(ymd) => ymd > today} onPick={(ymd) => set({ removeFromProgramList: true, dashboardShowAt: `${ymd}T06:00` })} />
                    )}
                  </div>
                )}
              </>
            )}
            {!repeats(d) && <Check checked={d.hideWhenPast} onChange={(v) => set({ hideWhenPast: v })} title="Take it down once it's over" line="It's archived the morning after." />}
            <p className="ps-hint">Anyone with the link can always open its page.</p>
          </>
        );
      }
      default:
        return null;
    }
  }

  // ── The trail: the program taking shape ──
  function trail() {
    const curIdx = steps.indexOf(step);
    return (
      <aside className="ps-sofar" aria-label="Your answers so far">
        <details open={trailOpen} onToggle={(e) => setTrailOpen(e.currentTarget.open)}>
          <summary className="ps-sofar__toggle"><span>Your answers so far</span><span className="ps-hint">{steps.filter((x) => d.setup.seen.includes(x.id)).length} of {steps.length}</span></summary>
          <p className="ps-sofar__title">Your answers so far</p>
          <ul className="ps-sofar__list">
            {SETUP_SECTIONS.map((sec) => {
              const mine = steps.filter((x) => x.sec === sec.id);
              const done = mine.length > 0 && mine.every((x) => d.setup.seen.includes(x.id) && (view === "review" || steps.indexOf(x) < curIdx));
              const now = view === "walk" && step.sec === sec.id;
              const reached = mine.filter((x) => d.setup.seen.includes(x.id) || (view === "walk" && x === step));
              return (
                <li key={sec.id} className={`ps-sofar__sec${done ? " ps-sofar__sec--done" : ""}${now ? " ps-sofar__sec--now" : ""}`}>
                  <p className="ps-sofar__name"><span className="ps-sofar__mark" aria-hidden="true">{done ? "✓" : ""}</span>{sec.name}</p>
                  {reached.length > 0 && (
                    <ul className="ps-sofar__answers">
                      {reached.map((x) => {
                        const here = view === "walk" && x === step;
                        const redo = d.setup.redo?.[x.id] || "";
                        return (
                          <li key={x.id}>
                            <button type="button" className={`ps-sofar__answer${here ? " ps-sofar__answer--now" : ""}${redo ? " ps-sofar__answer--redo" : ""}`} aria-current={here ? "step" : undefined} onClick={() => go(x.id, view === "review")}>
                              {here ? "You're here" : redo || x.answer(d) || "…"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="ps-sofar__foot">Tap any answer to go back to it. Nothing is lost when you do.</p>
        </details>
      </aside>
    );
  }

  const saved = saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved: check your connection. Your answers are still here." : "Saved as you go.";
  const title = d.name.trim() || "A new program";
  const head = (
    <div className="ps-head">
      <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
      <h1>{title}</h1>
      <p className="ps-state"><strong>Draft</strong> · {saved} No one sees it, and no team is told, until you publish.{startedAs ? ` Started from ${startedAs}.` : ""}</p>
    </div>
  );

  if (edit) {
    const sec = SETUP_SECTIONS.find((x) => x.id === edit.section)!;
    const editHead = (
      <div className="ps-head">
        <button type="button" className="app-back ps-back" onClick={() => edit.onClose()}>&larr; {initial.name}</button>
        <h1>Change: {sec.name}</h1>
        <p className="ps-state">Nothing changes until you&rsquo;ve seen what it does and said yes.</p>
      </div>
    );
    if (view === "confirm") {
      return (
        <div className="ps-page">
          {editHead}
          <div className="ps-review">
            <section className="ps-card" aria-labelledby="ps-as-will-be">
              <div className="ps-card__head"><h2 id="ps-as-will-be">{sec.name}, as it will be</h2></div>
              <div className="ps-card__body"><SectionSays d={d} section={edit.section} /></div>
            </section>
            <section className="ps-card" aria-labelledby="ps-what-changes">
              <div className="ps-card__head"><h2 id="ps-what-changes">What this changes</h2></div>
              <div className="ps-card__body">
                {!preview ? <p>Working out what this changes…</p> : preview.effects.length > 0 && <ul className="ps-effects">{preview.effects.map((e) => <li key={e}>{e}</li>)}</ul>}
                <p className="ps-hint">Nothing has happened yet.</p>
                <div className="ps-actions">
                  <button type="button" className="pe-btn pe-btn--primary" onClick={saveChange} disabled={!preview || saving || !!firstGap() || (!!saveError && !preview.effects.length)}>{saving ? "Saving…" : "Save this change"}</button>
                  <button type="button" className="app-act" onClick={() => { setView("walk"); setSaveError(""); }}>Back to the questions</button>
                  <button type="button" className="app-act" onClick={() => edit.onClose()}>Cancel the change</button>
                </div>
                {saveError && <p className="ps-problem" role="alert">{saveError}</p>}
              </div>
            </section>
          </div>
        </div>
      );
    }
  }

  if (view === "review") {
    const missing = missingForPublish(d);
    // Who reads people's answers is the registration team's choice: a draft
    // where they've chosen it is theirs to publish.
    const forRegistration = !canDecideAskers && (d.registrationFields.some((f) => !!f.askedBy) || (d.helperTeams ?? []).length > 0);
    return (
      <div className="ps-page">
        {head}
        <div className="ps-grid">
          <div className="ps-review">
            {SETUP_SECTIONS.map((sec) => {
              const mine = liveSteps(d, sec.id as SetupSection);
              if (!mine.length) return null;
              return (
                <section key={sec.id} className="ps-card" aria-labelledby={`ps-card-${sec.id}`}>
                  <div className="ps-card__head">
                    <h2 id={`ps-card-${sec.id}`}>{sec.name}</h2>
                    <button type="button" className="ps-card__change" onClick={() => go(mine[0].id, true)} aria-label={`Change ${sec.name}`}>Change</button>
                  </div>
                  <div className="ps-card__body">
                    <SectionSays d={d} section={sec.id as SetupSection} />
                  </div>
                </section>
              );
            })}
            <section className="ps-card" aria-labelledby="ps-card-publish">
              <div className="ps-card__head"><h2 id="ps-card-publish">When you publish</h2></div>
              <div className="ps-card__body">
                {missing.length > 0 && (
                  <Note look>
                    <p><strong>Before it can be published:</strong></p>
                    {missing.map((m) => <p key={m.step.id}><button type="button" className="ps-inline" onClick={() => go(m.step.id, true)}>{m.need}</button></p>)}
                  </Note>
                )}
                {forRegistration && (
                  <Note look><p>Someone on the registration team chose who asks the questions or which team prepares, so the registration team publishes this one. Everything else here is yours to change.</p></Note>
                )}
                <ul className="ps-effects">{effects(d, teams).map((e) => <li key={e}>{e}</li>)}</ul>
                <p className="ps-hint">Until then it&rsquo;s a draft: none of this has happened yet.</p>
                <div className="ps-actions">
                  <button type="button" className="pe-btn pe-btn--primary" onClick={publish} disabled={missing.length > 0 || publishing || forRegistration}>{publishing ? "Publishing…" : "Publish"}</button>
                  <Link href="/tools/programs" className="app-act">Keep it as a draft</Link>
                  {!confirmDiscard ? (
                    <button type="button" className="app-act app-act--danger" onClick={() => setConfirmDiscard(true)}>Discard this draft</button>
                  ) : (
                    <span className="ps-confirm" role="group" aria-label="Discard this draft?">
                      Discard it? This can&rsquo;t be undone.
                      <button type="button" className="pe-btn pe-btn--danger" onClick={discard}>Yes, discard it</button>
                      <button type="button" className="app-act" onClick={() => setConfirmDiscard(false)}>Keep it</button>
                    </span>
                  )}
                </div>
                {publishError && <p className="ps-problem" role="alert">{publishError}</p>}
              </div>
            </section>
          </div>
          {trail()}
        </div>
      </div>
    );
  }

  const secSteps = steps.filter((x) => x.sec === step.sec);
  const look = step.look?.(d);
  const redo = d.setup.redo?.[step.id] || "";
  const last = idx === steps.length - 1;
  return (
    <div className="ps-page">
      {edit ? (
        <div className="ps-head">
          <button type="button" className="app-back ps-back" onClick={() => edit.onClose()}>&larr; {initial.name}</button>
          <h1>Change: {SETUP_SECTIONS.find((x) => x.id === edit.section)?.name}</h1>
          <p className="ps-state">Nothing changes until you&rsquo;ve seen what it does and said yes.</p>
        </div>
      ) : head}
      <div className="ps-grid">
        <section className="ps-step" aria-labelledby="ps-q">
          <p className="ps-step__where">{SETUP_SECTIONS.find((x) => x.id === step.sec)?.name} · {secSteps.indexOf(step) + 1} of {secSteps.length}</p>
          <h2 className="ps-step__q" id="ps-q" tabIndex={-1} ref={headingRef}>{step.q(d)}</h2>
          <div className="ps-step__body">
            {changeMsg && <Note><p><strong>You changed this.</strong> {changeMsg}</p></Note>}
            {redo && <Note look><p><strong>This needs choosing again.</strong> {redo}</p></Note>}
            {body(step)}
            {look && <Note look><p>{look}</p></Note>}
          </div>
          {problem && <p className="ps-problem" role="alert">{problem}</p>}
          <div className="ps-step__nav">
            <button type="button" className="pe-btn pe-btn--primary" onClick={() => next()}>
              {edit && last ? "See what this changes" : fromReview ? "Back to the review" : last ? "Review it all" : "Continue"}
            </button>
            {idx > 0 && !fromReview && <button type="button" className="app-back ps-back" onClick={() => go(steps[idx - 1].id)}>&larr; Back</button>}
            {step.optional && !fromReview && !last && <button type="button" className="app-act ps-skip" onClick={() => next(true)}>Skip this for now</button>}
          </div>
        </section>
        {trail()}
      </div>
    </div>
  );
}

/** A section's answers as sentences: the review, Before you save, and the program's page. */
export function SectionSays({ d, section }: { d: SetupData; section: SetupSection }) {
  if (section === "when") return <WhenSays d={d} />;
  return (
    <>
      {liveSteps(d, section).map((st) => {
        const need = st.need?.(d);
        const look = st.look?.(d);
        return <p key={st.id} className={need || look ? "ps-look" : undefined}>{need || look || (st.says ? st.says(d) : `${st.answer(d)}.`)}</p>;
      })}
    </>
  );
}

/** When and where, said whole on the review. */
function WhenSays({ d }: { d: SetupData }) {
  const where = { "in-person": "In person", virtual: "Online", hybrid: "In person and online" }[d.programFormat] ?? "";
  const place = inPerson(d) ? (d.venue === "other" ? (d.locationText ? `, ${d.locationText}` : "") : " at RIM") : "";
  const room = online(d) ? (d.setup.room === "outside" ? ", in someone else's meeting" : ", on RIM's Zoom") : "";
  const days = sessionDays(d);
  const sentence = scheduleSentence(d);
  return (
    <>
      <p>{where}{place}{room}.</p>
      {sentence
        ? <p><strong>{sentence}</strong>{repeats(d) ? (d.setup.ends === "never" ? " It goes on." : ` ${days.length} session${days.length === 1 ? "" : "s"}.`) : ""}</p>
        : <p className="ps-look">When it meets isn&rsquo;t set yet.</p>}
      {repeats(d) && days.length > 0 && (
        <ul className="ps-result__dates">
          {days.slice(0, 8).map((x) => <li key={x}>{fmtShort(x)}</li>)}
          {days.length > 8 && <li>and {days.length - 8} more</li>}
        </ul>
      )}
      {d.earlyArrivalMessage && <p>On the day: &ldquo;{d.earlyArrivalMessage}&rdquo;</p>}
    </>
  );
}

/** The section on Programs & Events, as visitors will see it, with this program in its place. */
function ListedHere({ d, listed, onFirst }: { d: SetupData; listed: ListedProgram[]; onFirst: (v: boolean) => void }) {
  const section = SECTION_TITLE[d.offeringCategory];
  if (!section) return null;
  const p = scheduleOf(d);
  const me = {
    name: d.name.trim() || "This program",
    key: orderKey({ ...p, listFirst: d.listFirst ? 999_999 : null }),
    when: [patternWords(d) || (firstDay(d) ? fmtLong(firstDay(d)) : ""), repeats(d) && d.setup.ends !== "never" && firstDay(d) ? `from ${fmtLong(firstDay(d))}` : ""].filter(Boolean).join(", "),
    me: true,
  };
  const all = [...listed.filter((x) => x.category === d.offeringCategory).map((x) => ({ ...x, me: false })), me]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.name.localeCompare(b.name)));
  return (
    <div className="ps-result ps-indent">
      <p className="ps-result__label">It&rsquo;ll be listed under {section}, here:</p>
      <ol className="ps-listed">
        {all.map((x, i) => (
          <li key={i} className={x.me ? "ps-listed__me" : undefined}>
            {x.name}{x.when ? <span className="ps-hint"> · {x.when}</span> : null}{x.key.startsWith("0|") ? <span className="ps-hint"> (shown first)</span> : null}
          </li>
        ))}
      </ol>
      <Check checked={d.listFirst} onChange={onFirst} title="Show it first in its section" line="Otherwise it takes its place by when it meets." />
    </div>
  );
}

/** What publishing will set off, said before it happens. */
function effects(d: SetupData, teams: Props["teams"]): string[] {
  const out: string[] = [];
  const never = d.offeringCategory === "PRIVATE" || d.offeringCategory === "SERVICE";
  const section = SECTION_TITLE[d.offeringCategory];
  if (!d.hideFromProgramPageList && !never && section) {
    out.push(`It appears on Programs & Events under ${section}${!d.hideFromWeeklySchedule ? ", and on This Week in the weeks it meets" : ""}.`);
  } else out.push("It isn't listed. Anyone with its link can open its page.");
  if (registers(d)) out.push(d.setup.opens === "date" && d.registrationOpensAt ? `Registration opens on ${fmtLong(d.registrationOpensAt.slice(0, 10))}.` : "Registration opens.");
  else if (d.openEntry) out.push("Anyone signed in may simply come.");
  if (online(d) && d.setup.host !== "none") {
    const team = teams.hosting.find((t) => t.slug === (d.hostingHubSlug || "host-team"));
    out.push(`${team ? `The ${team.name}` : "The hosting team"} is told it needs a host, and its sessions appear in their Scheduler.`);
  }
  for (const slug of d.coverageHubSlugs ?? []) {
    const team = teams.supporting.find((t) => t.slug === slug && t.formats.includes(d.programFormat));
    if (team) out.push(`The ${team.name} is told, and can sign up for sessions.`);
  }
  for (const h of d.helperTeams ?? []) {
    const team = teams.prepare.find((t) => t.id === h.hubId);
    if (team) out.push(`The ${team.name} sees it in Helping with.`);
  }
  if (online(d) && d.setup.room === "rim") out.push("A Zoom meeting is made for each session, just before it opens.");
  return out;
}

