"use client";

/**
 * What the program editor's sections share (Phase 2, 2026-10-24): the field
 * types, the date-and-time picker, the section frame, and the section list.
 * The editor is one page in seven sections (RIM_ProgramEditor.md); each
 * section is its own memoized component, so typing in one redraws only it.
 *
 * CSS prefix: pe-
 */

import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

export const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 300 }} /> },
);

export function toEditorString(value: unknown): string {
  if (isHtmlString(value)) return value;
  return renderBlockNoteHtml(value) || "";
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeacherItem {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  /** ProgramCategory.hideFromProgramsPage: the whole category is off the public listing. */
  hidden?: boolean;
}

export interface RegistrationField {
  /** The question's id, set by the save route; kept through edits (lib/registrationFields.ts). */
  _key?: string;
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required: boolean;
  options: string[];
}

export interface EditorHub {
  slug: string;
  name: string;
  hasSchedule?: boolean;
  appliesToFormats?: string[];
  usesScheduler?: boolean;
}

/** A useState setter: stable across renders, so it never breaks a memo. */
export type Setter<T> = (value: T | ((prev: T) => T)) => void;

/** The implicit default hub when `Program.hostingHubSlug` is null.
 *  Mirrors `lib/programHub.ts::DEFAULT_HOSTING_HUB_SLUG`. */
export const DEFAULT_HOSTING_HUB_SLUG = "host-team" as const;

// ─── The sections, in the order a person decides them ────────────────────────

export const SECTIONS = [
  { id: "about", title: "About" },
  { id: "when", title: "When and where" },
  { id: "helping", title: "Who’s helping" },
  { id: "join", title: "How people join" },
  { id: "tell", title: "What we tell them" },
  { id: "dana", title: "Dana" },
  { id: "where", title: "Where it appears" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

export const sectionDomId = (id: SectionId) => `pe-sec-${id}`;
export const sectionTitle = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.title;

/** Scroll to a section. From the section list, focus moves to its heading too,
 *  so a screen reader and the eye land in the same place; from the Jump to
 *  menu it stays on the menu, so the keyboard can keep stepping through it. */
export function goToSection(id: SectionId, { focus = true }: { focus?: boolean } = {}) {
  const heading = document.getElementById(`${sectionDomId(id)}-title`);
  if (!heading) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.closest("section")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (focus) heading.focus({ preventScroll: true });
}

export function EditorSection({
  id,
  children,
}: {
  id: SectionId;
  children: React.ReactNode;
}) {
  const domId = sectionDomId(id);
  return (
    <section id={domId} className="pe-sec" aria-labelledby={`${domId}-title`}>
      <h3 className="pe-sec__title" id={`${domId}-title`} tabIndex={-1}>{sectionTitle(id)}</h3>
      <div className="pe-card">{children}</div>
    </section>
  );
}

/* ── Date + time picker (replaces datetime-local) ─────────────────────────
   Renders a date input + hour / minute / AM–PM selects.
   Value and onChange use the same datetime-local string format (YYYY-MM-DDTHH:mm)
   so the rest of the form and save payload don't change at all.
   Minutes snap to 15-minute increments. ── */
// Hoisted to module scope so these option lists aren't reallocated on every
// render — keeps the selects snappy.
const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = ["00", "15", "30", "45"];
export function DateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; /** Names the four controls for screen readers ("Start date and time"). */ label: string }) {
  const parse = (v: string) => {
    if (!v) return { date: "", hour: "7", minute: "00", ampm: "PM" };
    const [datePart, timePart] = v.split("T");
    if (!timePart) return { date: datePart ?? "", hour: "7", minute: "00", ampm: "PM" };
    const [hStr, mStr] = timePart.split(":");
    const h24 = parseInt(hStr ?? "19", 10);
    const m = parseInt(mStr ?? "0", 10);
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    // Snap to nearest 15-minute mark
    const mSnapped = Math.min(45, Math.round(m / 15) * 15);
    return { date: datePart ?? "", hour: String(h12), minute: String(mSnapped).padStart(2, "0"), ampm };
  };

  const { date, hour, minute, ampm } = parse(value);

  const emit = (d: string, h: string, mn: string, ap: string) => {
    if (!d) { onChange(""); return; }
    const h12 = parseInt(h, 10);
    const h24 = ap === "AM" ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
    onChange(`${d}T${String(h24).padStart(2, "0")}:${mn}`);
  };

  return (
    <div className="pe-datetime" role="group" aria-label={label}>
      <input
        type="date"
        aria-label={`${label}: date`}
        value={date}
        onChange={(e) => emit(e.target.value, hour, minute, ampm)}
        className="pe-datetime__date"
      />
      <div className="pe-datetime__time">
        <select aria-label={`${label}: hour`} value={hour} onChange={(e) => emit(date, e.target.value, minute, ampm)} className="pe-datetime__select">
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="pe-datetime__colon">:</span>
        <select aria-label={`${label}: minutes`} value={minute} onChange={(e) => emit(date, hour, e.target.value, ampm)} className="pe-datetime__select">
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select aria-label={`${label}: AM or PM`} value={ampm} onChange={(e) => emit(date, hour, minute, e.target.value)} className="pe-datetime__select pe-datetime__select--ampm">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
