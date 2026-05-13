"use client";

/**
 * ProgramEditor — six-tab form for creating and editing programs.
 * Mirrors the Sanity Studio tab layout so LoriLee's muscle memory transfers.
 *
 * CSS prefix: pe-
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { upload } from "@vercel/blob/client";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

interface TeacherItem {
  id: string;
  firstName: string;
  lastName: string;
}

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 300 }} /> },
);
// Phase 4: ProgramEditor's prose editors (danaMessage, confirmationMessage,
// reminderMessage) are now RimTiptapEditor variant=message. The description
// editor was migrated to variant=document in Phase 3.
function toEditorString(value: unknown): string {
  if (isHtmlString(value)) return value;
  return renderBlockNoteHtml(value) || "";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface RegistrationField {
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required: boolean;
  options: string[];
}

export interface ProgramData {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  programImage: string;
  description: any;
  pullQuote: string;
  pullQuoteSource: string;
  programNotes: any;
  teacherFacilitators: string[];
  programTeachers: { id: string; firstName: string; lastName: string }[];
  categoryId: string;
  dateText: string;
  timeText: string;
  programFormat: string;
  venue: string;
  locationText: string;
  locationLink: string;
  startDatetime: string;
  endDatetime: string;
  recurrenceFreq: string;
  recurrenceInterval: string;
  recurrenceDays: string[];
  recurrenceCount: string;
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationCapacity: string;
  registrationDeadline: string;
  registrationFields: RegistrationField[];
  confirmationMessage: any;
  reminderDate: string;
  reminderMessage: any;
  danaMode: string;
  suggestedDana: string;
  danaBaseAmount: string;
  danaFixedAmount: string;
  danaMessage: any;
  danaText: string;
  specialAnnouncement: string;
  earlyArrivalMessage: string;
  hideFromDashboard: boolean;
  dayOfWeek: string[];
  sortOrder: string;
  removeFromProgramList: boolean;
  dashboardShowAt: string;
  hideFromProgramPageList: boolean;
  hideFromWeeklySchedule: boolean;
  isOpenAccess: boolean;
  guestAccessKey: string;
}

interface Props {
  hubSlug?: string;
  /** Base path for navigation (e.g. "/tools/programs"). Falls back to hub-based path if not set. */
  basePath?: string;
  initialData?: ProgramData;
  isEditing: boolean;
  categories: Category[];
}

/* ── Dana message templates ────────────────────────────────────────────────
   Built-in templates are plain strings converted to BlockNote JSON on load.
   Custom templates are saved as BlockNote JSON to localStorage.
   ── */

/** Wrap a plain string in a single HTML paragraph. */
function textToHtml(text: string): string {
  // Minimal HTML escape for the few characters that matter inside a <p>.
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${safe}</p>`;
}

const DANA_BUILTIN: { name: string; text: string }[] = [
  {
    name: "General support",
    text: "Your dana makes this program possible. RIM is supported entirely by the generosity of our community — teachers, staff, and space are sustained by your offerings. Offer whatever feels right, and know that every amount is deeply appreciated.",
  },
  {
    name: "Teacher support",
    text: "Dana offered here goes directly to support the teacher. This is an ancient practice of reciprocity — teachings are offered freely, and we give back as we are able. All amounts are welcome.",
  },
  {
    name: "Sliding scale / no one turned away",
    text: "We offer this program on a sliding scale so it is accessible to everyone. Please offer an amount that reflects both your means and your appreciation for the teaching. No one is turned away for lack of funds.",
  },
];

const DANA_LS_KEY = "rim_dana_templates";
const DANA_LS_HIDDEN_KEY = "rim_dana_templates_hidden";

function loadDanaTemplates(): { name: string; content: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DANA_LS_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Convert any legacy BlockNote-JSON content to HTML strings on read.
    return raw.map((t: { name: string; content: unknown }) => ({
      name: t.name,
      content: isHtmlString(t.content) ? t.content : (renderBlockNoteHtml(t.content) || ""),
    }));
  } catch { return []; }
}
function loadHiddenBuiltins(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DANA_LS_HIDDEN_KEY) ?? "[]"); }
  catch { return []; }
}

function DanaTemplateSelector({ onLoad, value }: { onLoad: (v: string) => void; value: string }) {
  const [saved, setSaved] = useState<{ name: string; content: string }[]>([]);
  const [hiddenBuiltins, setHiddenBuiltins] = useState<string[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [lastLoadedName, setLastLoadedName] = useState("");

  useEffect(() => {
    setSaved(loadDanaTemplates());
    setHiddenBuiltins(loadHiddenBuiltins());
  }, []);

  const hasContent = value.replace(/<[^>]+>/g, "").trim().length > 0;
  const visibleBuiltins = DANA_BUILTIN.filter((t) => !hiddenBuiltins.includes(t.name));
  const allHidden = visibleBuiltins.length === 0;

  function load(content: string, name: string) {
    setLastLoadedName(name);
    onLoad(content);
  }

  function saveTemplate() {
    const name = saveName.trim();
    if (!name || !hasContent) return;
    const base = loadDanaTemplates();
    const updated = [...base.filter((t) => t.name !== name), { name, content: value }];
    localStorage.setItem(DANA_LS_KEY, JSON.stringify(updated));
    setSaved(updated);
    setSaveName("");
    setShowSave(false);
  }

  function deleteCustom(name: string) {
    const updated = saved.filter((t) => t.name !== name);
    localStorage.setItem(DANA_LS_KEY, JSON.stringify(updated));
    setSaved(updated);
  }

  function hideBuiltin(name: string) {
    const updated = [...hiddenBuiltins, name];
    localStorage.setItem(DANA_LS_HIDDEN_KEY, JSON.stringify(updated));
    setHiddenBuiltins(updated);
  }

  function restoreBuiltins() {
    localStorage.removeItem(DANA_LS_HIDDEN_KEY);
    setHiddenBuiltins([]);
  }

  const hasAnyTemplates = visibleBuiltins.length > 0 || saved.length > 0;

  return (
    <div className="pe-template-bar">
      {/* Header: label + save button */}
      <div className="pe-template-bar__header">
        <span className="pe-template-bar__label">Templates</span>
        <button
          type="button"
          className="pe-template-bar__save-btn"
          onClick={() => { setShowSave((s) => !s); setSaveName(lastLoadedName); }}
          disabled={!hasContent}
          title="Save what's currently in the editor as a reusable template"
        >
          + Save current
        </button>
      </div>

      {/* Save name input */}
      {showSave && (
        <div className="pe-template-bar__save-row">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name…"
            className="pe-input pe-template-bar__name-input"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTemplate(); } }}
            autoFocus
          />
          <button type="button" className="pe-btn pe-btn--small" onClick={saveTemplate} disabled={!saveName.trim()}>Save</button>
          <button type="button" className="pe-btn pe-btn--small pe-btn--ghost" onClick={() => setShowSave(false)}>Cancel</button>
        </div>
      )}

      {/* Chips */}
      {hasAnyTemplates && (
        <div className="pe-template-bar__chips">
          {visibleBuiltins.map((t) => (
            <span key={t.name} className="pe-template-chip pe-template-chip--builtin">
              <button type="button" className="pe-template-chip__name" onClick={() => load(textToHtml(t.text), t.name)}>{t.name}</button>
              <button type="button" className="pe-template-chip__delete" onClick={() => hideBuiltin(t.name)} title="Remove">×</button>
            </span>
          ))}
          {saved.map((t) => (
            <span key={t.name} className="pe-template-chip">
              <button type="button" className="pe-template-chip__name" onClick={() => load(t.content, t.name)}>{t.name}</button>
              <button type="button" className="pe-template-chip__delete" onClick={() => deleteCustom(t.name)} title="Delete">×</button>
            </span>
          ))}
        </div>
      )}
      {allHidden && (
        <button type="button" className="pe-template-bar__restore" onClick={restoreBuiltins}>Restore default templates</button>
      )}
    </div>
  );
}

/* ── Date + time picker (replaces datetime-local) ─────────────────────────
   Renders a date input + hour / minute / AM–PM selects.
   Value and onChange use the same datetime-local string format (YYYY-MM-DDTHH:mm)
   so the rest of the form and save payload don't change at all.
   Minutes snap to 15-minute increments. ── */
function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

  const HOURS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  const MINUTES = ["00","15","30","45"];

  return (
    <div className="pe-datetime">
      <input
        type="date"
        value={date}
        onChange={(e) => emit(e.target.value, hour, minute, ampm)}
        className="pe-datetime__date"
      />
      <div className="pe-datetime__time">
        <select value={hour} onChange={(e) => emit(date, e.target.value, minute, ampm)} className="pe-datetime__select">
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="pe-datetime__colon">:</span>
        <select value={minute} onChange={(e) => emit(date, hour, e.target.value, ampm)} className="pe-datetime__select">
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ampm} onChange={(e) => emit(date, hour, minute, e.target.value)} className="pe-datetime__select pe-datetime__select--ampm">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/* ── Inline category ordering with add/delete ── */
function CategoryOrderInline({ categories: initial }: { categories: Category[] }) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function move(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setItems(next);
    setSaving(true);
    try {
      await fetch("/api/programs-pg/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
      });
    } catch { setItems(items); }
    finally { setSaving(false); }
  }

  async function addCategory() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/programs-pg/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const cat = await res.json();
        setItems([...items, { id: cat.id, slug: cat.slug, name: cat.name }]);
        setNewName("");
      }
    } catch {}
    finally { setAdding(false); }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/programs-pg/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems(items.filter(c => c.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Could not delete category.");
      }
    } catch {}
    finally { setSaving(false); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="catord__list">
        {items.map((cat, i) => (
          <div key={cat.id} className="catord__row">
            <div className="catord__arrows">
              <button type="button" className="catord__arrow" disabled={i === 0 || saving} onClick={() => move(i, "up")}>↑</button>
              <button type="button" className="catord__arrow" disabled={i === items.length - 1 || saving} onClick={() => move(i, "down")}>↓</button>
            </div>
            <span className="catord__name">{cat.name}</span>
            <button type="button" className="catord__delete" onClick={() => deleteCategory(cat.id, cat.name)} disabled={saving}>×</button>
          </div>
        ))}
      </div>
      <div className="catord__add">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
          placeholder="New category name"
          className="catord__add-input"
          disabled={adding}
        />
        <button type="button" onClick={addCategory} disabled={adding || !newName.trim()} className="catord__add-btn">
          {adding ? "Adding..." : "+ Add"}
        </button>
      </div>
      {saving && <span className="catord__saving">Saving...</span>}
    </div>
  );
}

const TABS = ["Content", "Schedule", "Categories", "Registration", "Dana", "Home Card", "Visibility"] as const;
type Tab = (typeof TABS)[number];

const DAY_OPTIONS = [
  { value: "SU", label: "Sun" },
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Schedule auto-generation helpers ────────────────────────────────────────

const DAY_FULL: Record<string, string> = {
  SU: "Sundays", MO: "Mondays", TU: "Tuesdays", WE: "Wednesdays",
  TH: "Thursdays", FR: "Fridays", SA: "Saturdays",
};
const DAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_ABBR_FROM_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Derive the time display string from datetime-local values (YYYY-MM-DDTHH:mm). */
function computeTimeText(start: string, end: string): string {
  if (!start) return "";
  const parseTime = (dt: string) => {
    const t = dt.split("T")[1];
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  };
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return { str: `${h12}${mStr}`, ampm };
  };
  const s = parseTime(start);
  if (!s) return "";
  const { str: sStr, ampm: sAmpm } = fmt(s.h, s.m);
  if (end) {
    const e = parseTime(end);
    if (e) {
      const { str: eStr, ampm: eAmpm } = fmt(e.h, e.m);
      if (sAmpm === eAmpm) return `${sStr}–${eStr} ${eAmpm} CT`;
      return `${sStr} ${sAmpm}–${eStr} ${eAmpm} CT`;
    }
  }
  return `${sStr} ${sAmpm} CT`;
}

/** Derive the schedule label from recurrence settings and start date. */
function computeDateText(start: string, freq: string, days: string[], interval: string): string {
  if (freq === "WEEKLY") {
    const ordered = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const names = ordered.map((d) => DAY_FULL[d] ?? d);
    const prefix = interval && Number(interval) > 1 ? `Every ${interval} weeks: ` : "";
    if (names.length === 0) return `${prefix}Weekly`;
    if (names.length === 1) return `${prefix}${names[0]}`;
    if (names.length === 2) return `${prefix}${names[0]} and ${names[1]}`;
    const last = names[names.length - 1];
    return `${prefix}${names.slice(0, -1).join(", ")}, and ${last}`;
  }
  if (freq === "DAILY") {
    const n = Number(interval);
    return !interval || n <= 1 ? "Daily" : `Every ${n} days`;
  }
  if (freq === "MONTHLY") {
    return "Monthly";
  }
  // One-time — derive from start date
  if (start) {
    const datePart = start.split("T")[0];
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    }
  }
  return "";
}

/** Derive dayOfWeek array from recurrence or start date — never manually set. */
function deriveDayOfWeek(freq: string, days: string[], start: string): string[] {
  if (freq === "WEEKLY" && days.length > 0) return days;
  if (freq === "DAILY") return DAY_ABBR_FROM_INDEX; // every day
  if (start) {
    const datePart = start.split("T")[0];
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      return [DAY_ABBR_FROM_INDEX[new Date(y, m - 1, d).getDay()]];
    }
  }
  return [];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProgramEditor({ hubSlug, basePath: basePathProp, initialData, isEditing, categories }: Props) {
  const basePath = basePathProp ?? `/account/hub/${hubSlug}/programs`;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Content");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugLocked, setSlugLocked] = useState(isEditing);
  const [uploading, setUploading] = useState(false);

  // ── State ────────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [tagline, setTagline] = useState(initialData?.tagline ?? "");
  const [programImage, setProgramImage] = useState(initialData?.programImage ?? "");
  // Lazy migration: convert legacy BlockNote JSON description to HTML on load.
  const [description, setDescription] = useState<string>(() => {
    const initial = initialData?.description;
    if (isHtmlString(initial)) return initial;
    return renderBlockNoteHtml(initial) || "";
  });
  const [pullQuote, setPullQuote] = useState(initialData?.pullQuote ?? "");
  const [pullQuoteSource, setPullQuoteSource] = useState(initialData?.pullQuoteSource ?? "");
  const [programNotes, setProgramNotes] = useState<string>(toEditorString(initialData?.programNotes));
  const [teacherFacilitatorsText, setTeacherFacilitatorsText] = useState(
    initialData?.teacherFacilitators?.join(", ") ?? ""
  );
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherItem[]>(initialData?.programTeachers ?? []);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<TeacherItem[]>([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const teacherDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [dateText, setDateText] = useState(initialData?.dateText ?? "");
  const [timeText, setTimeText] = useState(initialData?.timeText ?? "");

  // Dirty = user typed a custom override. False = keep label in sync with date/recurrence settings.
  // Initialised by comparing stored value to what the compute functions would produce.
  // dateText / timeText are server-computed on save (always recomputed from
  // start/end/recurrence). The editor mirrors them locally as a live preview.
  const [programFormat, setProgramFormat] = useState(initialData?.programFormat ?? "in-person");
  const [venue, setVenue] = useState(initialData?.venue ?? "at-rim");
  const [locationText, setLocationText] = useState(initialData?.locationText ?? "");
  const [locationLink, setLocationLink] = useState(initialData?.locationLink ?? "");
  const [startDatetime, setStartDatetime] = useState(initialData?.startDatetime ?? "");
  const [endDatetime, setEndDatetime] = useState(initialData?.endDatetime ?? "");
  const [recurrenceFreq, setRecurrenceFreq] = useState(initialData?.recurrenceFreq ?? "");
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialData?.recurrenceInterval ?? "");
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(initialData?.recurrenceDays ?? []);
  const [recurrenceCount, setRecurrenceCount] = useState(initialData?.recurrenceCount ?? "");

  const [registrationEnabled, setRegistrationEnabled] = useState(initialData?.registrationEnabled ?? false);
  const [registrationClosed, setRegistrationClosed] = useState(initialData?.registrationClosed ?? false);
  const [registrationCapacity, setRegistrationCapacity] = useState(initialData?.registrationCapacity ?? "");
  const [registrationDeadline, setRegistrationDeadline] = useState(initialData?.registrationDeadline ?? "");
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>(
    initialData?.registrationFields ?? []
  );
  // Raw string drafts for select option inputs — avoids split/join on every keystroke
  const [optionsDraft, setOptionsDraft] = useState<Record<number, string>>({});
  const [confirmationMessage, setConfirmationMessage] = useState<string>(toEditorString(initialData?.confirmationMessage));
  const [reminderDate, setReminderDate] = useState(initialData?.reminderDate ?? "");
  const [reminderMessage, setReminderMessage] = useState<string>(toEditorString(initialData?.reminderMessage));

  const [danaMode, setDanaMode] = useState(initialData?.danaMode ?? "none");
  const [suggestedDana, setSuggestedDana] = useState(initialData?.suggestedDana ?? "");
  const [danaBaseAmount, setDanaBaseAmount] = useState(initialData?.danaBaseAmount ?? "");
  const [danaFixedAmount, setDanaFixedAmount] = useState(initialData?.danaFixedAmount ?? "");
  const [danaMessage, setDanaMessage] = useState<string>(toEditorString(initialData?.danaMessage));
  const [danaEditorKey, setDanaEditorKey] = useState(0);
  const [danaText, setDanaText] = useState(initialData?.danaText ?? "");

  const [specialAnnouncement, setSpecialAnnouncement] = useState(initialData?.specialAnnouncement ?? "");
  const [earlyArrivalMessage, setEarlyArrivalMessage] = useState(initialData?.earlyArrivalMessage ?? "");
  const [hideFromDashboard, setHideFromDashboard] = useState(initialData?.hideFromDashboard ?? false);
  const [dayOfWeek, setDayOfWeek] = useState<string[]>(initialData?.dayOfWeek ?? []);

  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? "");
  const [removeFromProgramList, setRemoveFromProgramList] = useState(initialData?.removeFromProgramList ?? false);
  const [dashboardShowAt, setDashboardShowAt] = useState(initialData?.dashboardShowAt ?? "");
  const [hideFromProgramPageList, setHideFromProgramPageList] = useState(initialData?.hideFromProgramPageList ?? false);
  const [hideFromWeeklySchedule, setHideFromWeeklySchedule] = useState(initialData?.hideFromWeeklySchedule ?? false);

  const [isOpenAccess, setIsOpenAccess] = useState(initialData?.isOpenAccess ?? false);
  const [guestAccessKey, setGuestAccessKey] = useState(initialData?.guestAccessKey ?? "");
  const [resettingKey, setResettingKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ── Unsaved changes tracking ────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const markDirty = useCallback(() => { if (!dirty) setDirty(true); }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /** Wrap navigation — if dirty, show confirmation instead of navigating */
  function guardedNavigate(href: string) {
    if (dirty) {
      setPendingNav(href);
    } else {
      router.push(href);
    }
  }

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditing && !slugTouched && name) {
      setSlug(slugify(name));
    }
  }, [name, isEditing, slugTouched]);

  // Live preview only — server recomputes these on every save.
  useEffect(() => {
    const computed = computeDateText(startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval);
    setDateText(computed);
  }, [startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval]);

  useEffect(() => {
    const computed = computeTimeText(startDatetime, endDatetime);
    setTimeText(computed);
  }, [startDatetime, endDatetime]);

  // ── Teacher search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (teacherDebounceRef.current) clearTimeout(teacherDebounceRef.current);
    if (!teacherQuery.trim()) {
      setTeacherResults([]);
      return;
    }
    teacherDebounceRef.current = setTimeout(async () => {
      setTeacherSearching(true);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(teacherQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const mapped: TeacherItem[] = data.map((m: { id: string; firstName: string; lastName: string }) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          }));
          setTeacherResults(mapped.filter((t) => !selectedTeachers.some((s) => s.id === t.id)));
        }
      } catch {}
      setTeacherSearching(false);
    }, 300);
  }, [teacherQuery]);

  function addTeacher(teacher: TeacherItem) {
    setSelectedTeachers((prev) => [...prev, teacher]);
    setTeacherResults([]);
    setTeacherQuery("");
    markDirty();
  }

  function removeTeacher(id: string) {
    setSelectedTeachers((prev) => prev.filter((t) => t.id !== id));
    markDirty();
  }

  // ── Image upload ─────────────────────────────────────────────────────────
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setProgramImage(blob.url);
      markDirty();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Registration fields management ───────────────────────────────────────
  function addField() {
    setRegistrationFields((prev) => [
      ...prev,
      { label: "", fieldType: "shortText", required: false, options: [] },
    ]);
  }

  function updateField(idx: number, updates: Partial<RegistrationField>) {
    setRegistrationFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...updates } : f))
    );
  }

  function removeField(idx: number) {
    setRegistrationFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: -1 | 1) {
    setRegistrationFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // ── Day toggle helpers ───────────────────────────────────────────────────
  function toggleDay(arr: string[], day: string): string[] {
    return arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day];
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    await doSave();
  }

  async function doSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name,
        slug,
        tagline,
        programImage: programImage || null,
        description,
        pullQuote,
        pullQuoteSource,
        programNotes,
        teacherFacilitators: teacherFacilitatorsText
          ? teacherFacilitatorsText.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        teacherIds: selectedTeachers.map((t) => t.id),
        categoryId: categoryId || null,
        dateText,
        timeText,
        programFormat,
        venue,
        locationText,
        locationLink,
        startDatetime: startDatetime || null,
        endDatetime: endDatetime || null,
        recurrenceFreq: recurrenceFreq || null,
        recurrenceInterval: recurrenceInterval ? Number(recurrenceInterval) : null,
        recurrenceDays,
        recurrenceCount: recurrenceCount ? Number(recurrenceCount) : null,
        registrationEnabled,
        registrationClosed,
        registrationCapacity: registrationCapacity ? Number(registrationCapacity) : null,
        registrationDeadline: registrationDeadline || null,
        registrationFields: registrationFields.length > 0 ? registrationFields : null,
        confirmationMessage,
        reminderDate: reminderDate || null,
        reminderMessage,
        danaMode,
        suggestedDana: suggestedDana ? Number(suggestedDana) : null,
        danaBaseAmount: danaBaseAmount ? Number(danaBaseAmount) : null,
        danaFixedAmount: danaFixedAmount ? Number(danaFixedAmount) : null,
        danaMessage,
        danaText,
        specialAnnouncement,
        earlyArrivalMessage,
        hideFromDashboard,
        dayOfWeek: deriveDayOfWeek(recurrenceFreq, recurrenceDays, startDatetime),
        sortOrder: sortOrder ? Number(sortOrder) : null,
        removeFromProgramList,
        dashboardShowAt: dashboardShowAt || null,
        hideFromProgramPageList,
        hideFromWeeklySchedule,
        isOpenAccess,
      };

      const url = isEditing ? `/api/programs-pg/${initialData?.slug}` : "/api/programs-pg";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      if (isEditing) {
        // Update guestAccessKey from response if it was generated
        const updated = await res.json();
        if (updated.guestAccessKey && !guestAccessKey) {
          setGuestAccessKey(updated.guestAccessKey);
        }
        // Clear key if open access was disabled
        if (!isOpenAccess) {
          setGuestAccessKey("");
        }
        setDirty(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        // If slug changed, redirect to new URL
        if (slug !== initialData?.slug) {
          router.push(`${basePath}/${slug}/edit`);
        }
      } else {
        const created = await res.json();
        router.push(`${basePath}/${created.slug}/edit`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const isVirtual = programFormat === "virtual" || programFormat === "hybrid";

  return (
    <div className="pe-editor" onChangeCapture={markDirty} onInputCapture={markDirty}>
      {/* ── Unsaved changes confirmation dialog ── */}
      {pendingNav && (
        <div className="pe-overlay" onClick={() => setPendingNav(null)}>
          <div className="pe-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="pe-dialog__text">You have unsaved changes. Leave without saving?</p>
            <div className="pe-dialog__actions">
              <button className="pe-btn pe-btn--primary" onClick={() => setPendingNav(null)}>
                Stay on this page
              </button>
              <button
                className="pe-btn"
                onClick={() => { setDirty(false); router.push(pendingNav); }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pe-editor__header">
        <h2 className="pe-editor__title">{isEditing ? "Edit Program" : "New Program"}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
          {isEditing && slug && (
            <a href={`/programs/${slug}`} target="_blank" rel="noopener noreferrer" className="pe-link pe-link--view">
              View program page →
            </a>
          )}
          <Link href="/admin/manual/program-manager" target="_blank" className="pe-link pe-link--view">
            Help →
          </Link>
        </div>
      </div>

      {error && <div className="pe-msg pe-msg--error">{error}</div>}
      {success && <div className="pe-msg pe-msg--success">Saved successfully</div>}

      {/* ── Tab bar ── */}
      <div className="pe-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`pe-tabs__tab${tab === t ? " pe-tabs__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         TAB 1 — Content
         ══════════════════════════════════════════════════════════════════ */}
      {tab === "Content" && (
        <div className="pe-card">
          <div className="pe-card__section">
            <div className="pe-form">
              <label className="pe-field">
                <span className="pe-field__label">Name *</span>
                <span className="pe-field__help">The program title. This appears on the public site, on the member home, and in all emails.</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="pe-input" required />
              </label>

              <label className="pe-field">
                <span className="pe-field__label">Slug *</span>
                <span className="pe-field__help">The URL path for this program (e.g. /programs/morning-sit). Changing this after the program is live will break existing links and host assignments.</span>
                <div className="pe-slug-row">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                    className="pe-input"
                    disabled={slugLocked}
                    required
                  />
                  {isEditing && (
                    <button
                      type="button"
                      className="pe-btn pe-btn--small"
                      onClick={() => setSlugLocked(!slugLocked)}
                    >
                      {slugLocked ? "Unlock" : "Lock"}
                    </button>
                  )}
                </div>
                {isEditing && !slugLocked && (
                  <span className="pe-field__help pe-field__help--warn">
                    Changing the slug will break existing links and host assignments.
                  </span>
                )}
              </label>

              <label className="pe-field">
                <span className="pe-field__label">Tagline</span>
                <span className="pe-field__help">A one-line description shown below the program name on the Programs page and in search results.</span>
                <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="pe-input" />
              </label>

              <div className="pe-field">
                <span className="pe-field__label">Program Image</span>
                <span className="pe-field__help">Shown on the public program page and in the Programs listing. Landscape format works best.</span>
                {programImage && (
                  <div className="pe-image-preview">
                    <img src={programImage} alt="Program" className="pe-image-preview__img" />
                    <button type="button" className="pe-btn pe-btn--small pe-btn--danger" onClick={() => setProgramImage("")}>
                      Remove
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="pe-file-input"
                  disabled={uploading}
                />
                {uploading && <span className="pe-muted">Uploading…</span>}
              </div>
            </div>
          </div>

          <div className="pe-card__section">
            <div className="pe-form">
              <div className="pe-field">
                <span className="pe-field__label">Description</span>
                <span className="pe-field__help">The full program description shown on the public program page. Write for someone who has never been to RIM.</span>
                <RimTiptapEditor
                  value={description}
                  onChange={(v) => { setDescription(v); markDirty(); }}
                  placeholder="Program description…"
                  variant="document"
                />
              </div>
            </div>
          </div>

          <div className="pe-card__section">
            <div className="pe-form">
              <label className="pe-field">
                <span className="pe-field__label">Pull Quote</span>
                <span className="pe-field__help">An optional highlighted quote shown on the public program page — something that captures the spirit of this offering.</span>
                <input type="text" value={pullQuote} onChange={(e) => setPullQuote(e.target.value)} className="pe-input" />
              </label>

              <label className="pe-field">
                <span className="pe-field__label">Pull Quote Source</span>
                <span className="pe-field__help">Who said the pull quote. Appears below the quote in smaller text.</span>
                <input type="text" value={pullQuoteSource} onChange={(e) => setPullQuoteSource(e.target.value)} className="pe-input" />
              </label>
            </div>
          </div>

          <div className="pe-card__section">
            <div className="pe-form">
              <div className="pe-field">
                <span className="pe-field__label">Program Notes</span>
                <span className="pe-field__help">Additional notes shown on the public program detail page — scheduling context, accessibility info, what to bring, etc.</span>
                <RimTiptapEditor
                  value={programNotes}
                  onChange={(v) => { setProgramNotes(v); markDirty(); }}
                  placeholder="Program notes…"
                  variant="message"
                />
              </div>
            </div>
          </div>

          <div className="pe-card__section">
            <div className="pe-form">
              <div className="pe-field">
                <span className="pe-field__label">Teacher / Facilitators</span>
                <span className="pe-field__help">Search by name to link teachers to this program. Linked teachers automatically get host controls in virtual sessions.</span>

                {selectedTeachers.length > 0 && (
                  <div className="pe-teacher-tags">
                    {selectedTeachers.map((t) => (
                      <span key={t.id} className="pe-teacher-tag">
                        {t.firstName} {t.lastName}
                        <button
                          type="button"
                          className="pe-teacher-tag__remove"
                          onClick={() => removeTeacher(t.id)}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  value={teacherQuery}
                  onChange={(e) => setTeacherQuery(e.target.value)}
                  className="pe-input"
                  placeholder="Search teachers by name…"
                />
                {teacherSearching && <span className="pe-field__help">Searching…</span>}
                {teacherResults.length > 0 && (
                  <div className="pe-teacher-results">
                    {teacherResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="pe-teacher-result"
                        onClick={() => addTeacher(t)}
                      >
                        {t.firstName} {t.lastName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 2 — Schedule
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Schedule" && (
          <div className="pe-card"><div className="pe-form">
            <label className="pe-field">
              <span className="pe-field__label">Schedule Label</span>
              <span className="pe-field__help">How the schedule appears on the public site. Auto-generated from your recurrence and start date — change those above to update.</span>
              <input type="text" value={dateText} readOnly className="pe-input pe-input--readonly" />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Time Label</span>
              <span className="pe-field__help">Shown on program cards and in confirmation emails. Auto-generated from your start and end times — change those above to update.</span>
              <input type="text" value={timeText} readOnly className="pe-input pe-input--readonly" />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Program Format</span>
              <span className="pe-field__help">In-person, virtual, or hybrid. This controls whether a LiveKit video room or a venue address is shown.</span>
              <div className="pe-option-cards">
                {[
                  { value: "in-person", label: "In-person" },
                  { value: "virtual", label: "Virtual" },
                  { value: "hybrid", label: "Hybrid" },
                ].map((opt) => (
                  <label key={opt.value} className={`pe-option-card${programFormat === opt.value ? " pe-option-card--active" : ""}`}>
                    <input type="radio" name="programFormat" checked={programFormat === opt.value} onChange={() => setProgramFormat(opt.value)} />
                    <span className="pe-option-card__mark" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {programFormat !== "virtual" && (
              <div className="pe-field">
                <span className="pe-field__label">Venue</span>
                <span className="pe-field__help">Where the program takes place. &lsquo;At RIM&rsquo; auto-fills the RIM address. &lsquo;Other&rsquo; lets you enter a custom location.</span>
                <div className="pe-option-cards">
                  {[
                    { value: "at-rim", label: "At RIM" },
                    { value: "other", label: "Other location" },
                  ].map((opt) => (
                    <label key={opt.value} className={`pe-option-card${venue === opt.value ? " pe-option-card--active" : ""}`}>
                      <input type="radio" name="venue" checked={venue === opt.value} onChange={() => setVenue(opt.value)} />
                      <span className="pe-option-card__mark" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {programFormat !== "virtual" && venue === "other" && (
              <>
                <label className="pe-field">
                  <span className="pe-field__label">Location Text</span>
                  <span className="pe-field__help">The venue name and address shown on the program page and in confirmation emails.</span>
                  <input type="text" value={locationText} onChange={(e) => setLocationText(e.target.value)} className="pe-input" />
                </label>
                <label className="pe-field">
                  <span className="pe-field__label">Location Link</span>
                  <span className="pe-field__help">A link to the venue — Google Maps, a website, or directions. Shown as a clickable link on the program page.</span>
                  <input type="url" value={locationLink} onChange={(e) => setLocationLink(e.target.value)} className="pe-input" placeholder="https://…" />
                </label>
              </>
            )}

            {isVirtual && (
              <fieldset className="pe-field">
                <legend className="pe-field__label">Open Access</legend>
                <span className="pe-field__help">Virtual/hybrid only. When enabled, generates a guest link that lets anyone join without registering or logging in. Good for drop-in sessions.</span>
                <label className="pe-checkbox">
                  <input
                    type="checkbox"
                    checked={isOpenAccess}
                    onChange={(e) => setIsOpenAccess(e.target.checked)}
                  />
                  <span>Enable guest access link</span>
                </label>

                {isOpenAccess && isEditing && guestAccessKey && (() => {
                  const guestUrl = typeof window !== "undefined"
                    ? `${window.location.origin}/session/${slug}?key=${guestAccessKey}`
                    : `/session/${slug}?key=${guestAccessKey}`;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ display: "block", fontSize: "var(--text-xxs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b8fa3", marginBottom: 6 }}>
                        Guest Access Link
                      </span>
                      {/* URL row */}
                      <div style={{ display: "flex", borderRadius: 6, border: "1px solid #d5d5d5", overflow: "hidden", background: "#fff" }}>
                        <input
                          type="text"
                          readOnly
                          value={guestUrl}
                          onFocus={(e) => e.target.select()}
                          style={{
                            flex: 1, minWidth: 0,
                            padding: "9px 12px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-xs)", color: "#333",
                            border: "none", outline: "none", background: "transparent",
                            boxShadow: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(guestUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          style={{
                            flexShrink: 0,
                            padding: "0 18px",
                            background: copiedLink ? "#2d6a4f" : "#39607a",
                            color: "#fff",
                            border: "none",
                            fontFamily: "var(--font-sans)",
                            fontSize: "var(--text-xs)", fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "background 0.15s",
                          }}
                        >
                          {copiedLink ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      {/* Reset row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                        <button
                          type="button"
                          disabled={resettingKey}
                          onClick={async () => {
                            if (!confirm("Reset the guest link? The old link will stop working immediately.")) return;
                            setResettingKey(true);
                            try {
                              const res = await fetch(`/api/programs-pg/${slug}/guest-key`, { method: "POST" });
                              if (res.ok) {
                                const data = await res.json();
                                setGuestAccessKey(data.guestAccessKey);
                              }
                            } catch {}
                            setResettingKey(false);
                          }}
                          style={{
                            background: "none", border: "none", padding: 0,
                            fontSize: "var(--text-xs)", color: "var(--rim-text-muted)", cursor: "pointer",
                            textDecoration: "underline", fontFamily: "var(--font-sans)",
                            opacity: resettingKey ? 0.5 : 1,
                          }}
                        >
                          {resettingKey ? "Resetting…" : "Reset link"}
                        </button>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--rim-text-muted)" }}>— invalidates the old link immediately.</span>
                      </div>
                    </div>
                  );
                })()}

                {isOpenAccess && isEditing && !guestAccessKey && (
                  <p className="pe-field__help">
                    Save the program to generate the guest access link.
                  </p>
                )}

                {isOpenAccess && !isEditing && (
                  <p className="pe-field__help">
                    The guest link will be generated after the program is created.
                  </p>
                )}
              </fieldset>
            )}

            <div className="pe-field">
              <span className="pe-field__label">Start Date &amp; Time</span>
              <span className="pe-field__help">The date range for this program. For single-day events, set both to the same date.</span>
              <DateTimePicker value={startDatetime} onChange={(v) => { setStartDatetime(v); markDirty(); }} />
            </div>

            <div className="pe-field">
              <span className="pe-field__label">End Date &amp; Time</span>
              <DateTimePicker value={endDatetime} onChange={(v) => { setEndDatetime(v); markDirty(); }} />
            </div>

            <div className="pe-field">
              <span className="pe-field__label">Recurrence</span>
              <span className="pe-field__help">For repeating programs. Sets the pattern (weekly, daily, etc.) and how many times it occurs.</span>
              <div className="pe-option-cards">
                {[
                  { value: "", label: "One-time" },
                  { value: "DAILY", label: "Daily" },
                  { value: "WEEKLY", label: "Weekly" },
                  { value: "MONTHLY", label: "Monthly" },
                ].map((opt) => (
                  <label key={opt.value} className={`pe-option-card${recurrenceFreq === opt.value ? " pe-option-card--active" : ""}`}>
                    <input type="radio" name="recurrenceFreq" checked={recurrenceFreq === opt.value} onChange={() => { setRecurrenceFreq(opt.value); markDirty(); }} />
                    <span className="pe-option-card__mark" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {recurrenceFreq && (
              <label className="pe-field">
                <span className="pe-field__label">Repeat every</span>
                <div className="pe-inline-row">
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={recurrenceInterval}
                    onChange={(e) => { setRecurrenceInterval(e.target.value); markDirty(); }}
                    className="pe-input pe-input--narrow"
                  />
                  <span>{recurrenceFreq === "DAILY" ? "day(s)" : recurrenceFreq === "WEEKLY" ? "week(s)" : "month(s)"}</span>
                </div>
              </label>
            )}

            {recurrenceFreq === "WEEKLY" && (
              <div className="pe-field">
                <span className="pe-field__label">On days</span>
                <div className="pe-day-grid">
                  {DAY_OPTIONS.map((d) => (
                    <label key={d.value} className="pe-day-toggle">
                      <input
                        type="checkbox"
                        checked={recurrenceDays.includes(d.value)}
                        onChange={() => { setRecurrenceDays(toggleDay(recurrenceDays, d.value)); markDirty(); }}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {recurrenceFreq && (
              <label className="pe-field">
                <span className="pe-field__label">Number of occurrences</span>
                <span className="pe-field__help">Leave blank for ongoing.</span>
                <input
                  type="number"
                  min="2"
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

          </div></div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 3 — Categories
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Categories" && (
          <div className="pe-card"><div className="pe-form">
            <label className="pe-field">
              <span className="pe-field__label">Category</span>
              <span className="pe-field__help">Which section this program appears under on the public Programs &amp; Events page. Programs without a category won&rsquo;t appear on that page.</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="pe-select">
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Category Display Order</span>
              <span className="pe-field__help">Arrange the order categories appear on the programs page.</span>
              <CategoryOrderInline categories={categories} />
            </div>
          </div></div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 4 — Registration
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Registration" && (
          <div className="pe-card">
          <div className="pe-card__section">
            <div className="pe-form">
            <div className="pe-visibility-option">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                />
                <span className="pe-checkbox__label">Registration enabled</span>
              </label>
              <p className="pe-field__help">When checked, the public program page shows a registration form. When unchecked, visitors can read about the program but can&rsquo;t register.</p>
            </div>

            <div className="pe-visibility-option">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={registrationClosed}
                  onChange={(e) => setRegistrationClosed(e.target.checked)}
                />
                <span className="pe-checkbox__label">Registration closed</span>
              </label>
              <p className="pe-field__help">Manually closes registration. The page shows a &lsquo;Registration is closed&rsquo; notice instead of the form.</p>
            </div>

            <hr className="pe-section-divider" />

            <label className="pe-field">
              <span className="pe-field__label">Capacity</span>
              <span className="pe-field__help">Maximum number of registered participants. Leave blank for unlimited. When full, new registrations are automatically waitlisted.</span>
              <input
                type="number"
                min="1"
                value={registrationCapacity}
                onChange={(e) => setRegistrationCapacity(e.target.value)}
                className="pe-input pe-input--narrow"
              />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Registration Deadline</span>
              <span className="pe-field__help">Registration closes automatically after this date. Leave blank if there&rsquo;s no deadline.</span>
              <DateTimePicker value={registrationDeadline} onChange={setRegistrationDeadline} />
            </div>

            {/* Custom questions builder */}
            <div className="pe-field">
              <span className="pe-field__label">Custom Questions</span>
              <span className="pe-field__help">Additional questions shown on the registration form. Answers appear in the registration detail view.</span>
              {registrationFields.map((field, idx) => (
                <div key={idx} className="pe-reg-field">
                  <div className="pe-reg-field__row">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      className="pe-input"
                      placeholder="Question label"
                    />
                    <select
                      value={field.fieldType}
                      onChange={(e) => {
                        updateField(idx, { fieldType: e.target.value as RegistrationField["fieldType"] });
                        setOptionsDraft((prev) => { const next = { ...prev }; delete next[idx]; return next; });
                      }}
                      className="pe-select pe-select--narrow"
                    >
                      <option value="shortText">Short text</option>
                      <option value="longText">Long text</option>
                      <option value="yesNo">Yes / No</option>
                      <option value="select">Select</option>
                    </select>
                    <label className="pe-checkbox pe-checkbox--inline">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                      />
                      Req
                    </label>
                  </div>
                  {field.fieldType === "select" && (
                    <input
                      type="text"
                      value={optionsDraft[idx] ?? field.options.join(", ")}
                      onChange={(e) =>
                        setOptionsDraft((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const parsed = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                        updateField(idx, { options: parsed });
                        setOptionsDraft((prev) => {
                          const next = { ...prev };
                          delete next[idx];
                          return next;
                        });
                      }}
                      className="pe-input"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  )}
                  <div className="pe-reg-field__actions">
                    <button type="button" className="pe-btn pe-btn--small" onClick={() => moveField(idx, -1)} disabled={idx === 0}>↑</button>
                    <button type="button" className="pe-btn pe-btn--small" onClick={() => moveField(idx, 1)} disabled={idx === registrationFields.length - 1}>↓</button>
                    <button type="button" className="pe-btn pe-btn--small pe-btn--danger" onClick={() => removeField(idx)}>Remove</button>
                  </div>
                </div>
              ))}
              <button type="button" className="pe-btn pe-btn--small" onClick={addField}>
                + Add Question
              </button>
            </div>

            <div className="pe-field">
              <span className="pe-field__label">Confirmation Message</span>
              <span className="pe-field__help">Shown in the confirmation email after someone registers. Good for logistics like what to bring or how to prepare.</span>
              <RimTiptapEditor
                value={confirmationMessage}
                onChange={(v) => { setConfirmationMessage(v); markDirty(); }}
                placeholder="Optional custom message…"
                variant="message"
              />
            </div>

            <div className="pe-field">
              <span className="pe-field__label">Reminder Date</span>
              <span className="pe-field__help">When set, a reminder email can be sent to all registered participants on or after this date.</span>
              <DateTimePicker value={reminderDate} onChange={setReminderDate} />
            </div>

            <div className="pe-field">
              <span className="pe-field__label">Reminder Message</span>
              <span className="pe-field__help">The content of the reminder email. You&rsquo;ll send it manually from the registration detail page — it doesn&rsquo;t send automatically.</span>
              <RimTiptapEditor
                value={reminderMessage}
                onChange={(v) => { setReminderMessage(v); markDirty(); }}
                placeholder="Optional reminder message…"
                variant="message"
              />
            </div>

          </div>
          </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 5 — Dana
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Dana" && (
          <div className="pe-card"><div className="pe-form">
            <div className="pe-field">
              <span className="pe-field__label">Dana Mode</span>
              <span className="pe-field__help">How donations work for this program. &lsquo;Voluntary&rsquo; lets people give any amount. &lsquo;Base + Dana&rsquo; sets a minimum. &lsquo;Fixed&rsquo; sets an exact amount. &lsquo;None&rsquo; skips the donation step entirely.</span>
              <div className="pe-option-cards">
                {[
                  { value: "none", label: "None" },
                  { value: "voluntary", label: "Voluntary" },
                  { value: "base_plus_dana", label: "Base + Dana" },
                  { value: "fixed", label: "Fixed" },
                ].map((opt) => (
                  <label key={opt.value} className={`pe-option-card${danaMode === opt.value ? " pe-option-card--active" : ""}`}>
                    <input type="radio" name="danaMode" checked={danaMode === opt.value} onChange={() => setDanaMode(opt.value)} />
                    <span className="pe-option-card__mark" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {(danaMode === "voluntary" || danaMode === "base_plus_dana") && (
              <label className="pe-field">
                <span className="pe-field__label">Suggested Amount ($)</span>
                <span className="pe-field__help">Voluntary mode: a suggested donation amount shown during registration. Participants can change it.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={suggestedDana}
                  onChange={(e) => setSuggestedDana(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode === "base_plus_dana" && (
              <label className="pe-field">
                <span className="pe-field__label">Base Amount ($)</span>
                <span className="pe-field__help">Base + Dana mode: the minimum amount. Participants can add more on top of this.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={danaBaseAmount}
                  onChange={(e) => setDanaBaseAmount(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode === "fixed" && (
              <label className="pe-field">
                <span className="pe-field__label">Fixed Amount ($)</span>
                <span className="pe-field__help">Fixed mode: the exact amount charged. Participants cannot change it.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={danaFixedAmount}
                  onChange={(e) => setDanaFixedAmount(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode !== "none" && (
              <>
                <div className="pe-field">
                  <span className="pe-field__label">Dana Step Message</span>
                  <span className="pe-field__help">Shown during the donation step of registration. Use this to explain how dana supports RIM.</span>
                  <DanaTemplateSelector
                    value={danaMessage}
                    onLoad={(v) => {
                      setDanaMessage(v);
                      setDanaEditorKey((k) => k + 1); // remount editor with new content
                      markDirty();
                    }}
                  />
                  <RimTiptapEditor
                    key={danaEditorKey}
                    value={danaMessage}
                    onChange={(v) => { setDanaMessage(v); markDirty(); }}
                    placeholder="Describe how dana supports RIM and what participants should know…"
                    variant="message"
                  />
                </div>

                <label className="pe-field">
                  <span className="pe-field__label">Program Page Dana Note</span>
                  <span className="pe-field__help">Shown on the public program page near the registration form — a brief note about the dana model for this program.</span>
                  <textarea
                    value={danaText}
                    onChange={(e) => setDanaText(e.target.value)}
                    className="pe-textarea"
                    rows={2}
                  />
                </label>
              </>
            )}
          </div></div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 6 — Home Card
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Home Card" && (
          <div className="pe-card">
            <div className="pe-card__section">
              <p className="pe-tab-intro">These fields control what appears on program cards on the member home screen. Both are optional — leave blank if not needed.</p>
              <div className="pe-form">
                <label className="pe-field">
                  <span className="pe-field__label">Special Announcement</span>
                  <span className="pe-field__help">A bold notice shown on this program&rsquo;s home card. Use for urgent or time-sensitive info like a schedule change or room reassignment.</span>
                  <textarea
                    value={specialAnnouncement}
                    onChange={(e) => setSpecialAnnouncement(e.target.value)}
                    className="pe-textarea"
                    rows={2}
                  />
                </label>

                <label className="pe-field">
                  <span className="pe-field__label">Early Arrival Message</span>
                  <span className="pe-field__help">A quieter message shown on the home card — things like &lsquo;Please arrive 10 minutes early&rsquo; or &lsquo;Bring a cushion.&rsquo;</span>
                  <textarea
                    value={earlyArrivalMessage}
                    onChange={(e) => setEarlyArrivalMessage(e.target.value)}
                    className="pe-textarea"
                    rows={2}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 7 — Visibility
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Visibility" && (
          <div className="pe-card"><div className="pe-form">

            <label className="pe-field">
              <span className="pe-field__label">Sort Order</span>
              <span className="pe-field__help">Controls the display order on the public Programs page. Lower numbers appear first.</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="pe-input pe-input--narrow"
              />
            </label>

            <hr className="pe-section-divider" />

            <div className="pe-visibility-option">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={hideFromProgramPageList}
                  onChange={(e) => setHideFromProgramPageList(e.target.checked)}
                />
                <span className="pe-checkbox__label">Hide from public Programs &amp; Events page</span>
              </label>
              <p className="pe-field__help">This program won&rsquo;t appear on the public listing. Still accessible by direct URL.</p>
            </div>

            <div className="pe-visibility-option">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={hideFromWeeklySchedule}
                  onChange={(e) => setHideFromWeeklySchedule(e.target.checked)}
                />
                <span className="pe-checkbox__label">Hide from This Week&rsquo;s Schedule</span>
              </label>
              <p className="pe-field__help">This program won&rsquo;t appear on the weekly schedule page. Useful for special events or programs that shouldn&rsquo;t clutter the regular calendar.</p>
            </div>

            <div className="pe-visibility-option">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={removeFromProgramList}
                  onChange={(e) => {
                    setRemoveFromProgramList(e.target.checked);
                    if (!e.target.checked) setDashboardShowAt("");
                  }}
                />
                <span className="pe-checkbox__label">Hide from member home</span>
              </label>
              <p className="pe-field__help">This program won&rsquo;t appear on the member home. Still accessible by direct link and on the public site.</p>

              {removeFromProgramList && (
                <div className="pe-visibility-schedule">
                  <span className="pe-field__label">Auto-show on member home</span>
                  <p className="pe-field__help">Optional. On this date the program will automatically reappear on the member home — no manual action needed.</p>
                  <DateTimePicker value={dashboardShowAt} onChange={setDashboardShowAt} />
                  {dashboardShowAt && (
                    <button
                      type="button"
                      className="pe-visibility-schedule__clear"
                      onClick={() => setDashboardShowAt("")}
                    >
                      Clear scheduled date
                    </button>
                  )}
                </div>
              )}
            </div>

          </div></div>
        )}

      {/* ── Actions bar ── */}
      <div className="pe-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name || !slug}
          className="pe-btn pe-btn--primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => guardedNavigate(basePath)}
          className="pe-btn"
        >
          Cancel
        </button>
      </div>

    </div>
  );
}
