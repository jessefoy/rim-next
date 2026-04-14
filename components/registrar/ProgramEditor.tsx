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

interface TeacherItem {
  id: string;
  firstName: string;
  lastName: string;
}

const RimBlockEditor = dynamic(() => import("@/components/RimBlockEditor"), { ssr: false });
const RimProseEditor = dynamic(() => import("@/components/RimProseEditor"), { ssr: false });

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
  specialNotes: any;
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
  danaMessage: string;
  danaText: string;
  specialAnnouncement: string;
  earlyArrivalMessage: string;
  hideFromDashboard: boolean;
  dayOfWeek: string[];
  sortOrder: string;
  removeFromProgramList: boolean;
  hideFromProgramPageList: boolean;
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

const TABS = ["Content", "Schedule", "Categories", "Registration", "Dana", "Dashboard", "Visibility"] as const;
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
  const [description, setDescription] = useState<any>(initialData?.description ?? null);
  const [pullQuote, setPullQuote] = useState(initialData?.pullQuote ?? "");
  const [pullQuoteSource, setPullQuoteSource] = useState(initialData?.pullQuoteSource ?? "");
  const [specialNotes, setSpecialNotes] = useState<any>(initialData?.specialNotes ?? null);
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
  const [confirmationMessage, setConfirmationMessage] = useState<any>(initialData?.confirmationMessage ?? null);
  const [reminderDate, setReminderDate] = useState(initialData?.reminderDate ?? "");
  const [reminderMessage, setReminderMessage] = useState<any>(initialData?.reminderMessage ?? null);

  const [danaMode, setDanaMode] = useState(initialData?.danaMode ?? "none");
  const [suggestedDana, setSuggestedDana] = useState(initialData?.suggestedDana ?? "");
  const [danaBaseAmount, setDanaBaseAmount] = useState(initialData?.danaBaseAmount ?? "");
  const [danaFixedAmount, setDanaFixedAmount] = useState(initialData?.danaFixedAmount ?? "");
  const [danaMessage, setDanaMessage] = useState(initialData?.danaMessage ?? "");
  const [danaText, setDanaText] = useState(initialData?.danaText ?? "");

  const [specialAnnouncement, setSpecialAnnouncement] = useState(initialData?.specialAnnouncement ?? "");
  const [earlyArrivalMessage, setEarlyArrivalMessage] = useState(initialData?.earlyArrivalMessage ?? "");
  const [hideFromDashboard, setHideFromDashboard] = useState(initialData?.hideFromDashboard ?? false);
  const [dayOfWeek, setDayOfWeek] = useState<string[]>(initialData?.dayOfWeek ?? []);

  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? "");
  const [removeFromProgramList, setRemoveFromProgramList] = useState(initialData?.removeFromProgramList ?? false);
  const [hideFromProgramPageList, setHideFromProgramPageList] = useState(initialData?.hideFromProgramPageList ?? false);

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

  // Auto-generate Schedule Label whenever it's blank or just cleared
  useEffect(() => {
    if (!dateText) {
      const computed = computeDateText(startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval);
      if (computed) setDateText(computed);
    }
  }, [dateText, startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval]);

  // Auto-generate Time Label whenever it's blank or just cleared
  useEffect(() => {
    if (!timeText) {
      const computed = computeTimeText(startDatetime, endDatetime);
      if (computed) setTimeText(computed);
    }
  }, [timeText, startDatetime, endDatetime]);

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
        specialNotes,
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
        hideFromProgramPageList,
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
        {isEditing && slug && (
          <a href={`/programs/${slug}`} target="_blank" rel="noopener noreferrer" className="pe-link pe-link--view">
            View program page →
          </a>
        )}
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
                <span className="pe-field__help">The program title. This appears on the public site, in member dashboards, and in all emails.</span>
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
                <RimBlockEditor
                  value={description}
                  onChange={(v: any) => { setDescription(v); markDirty(); }}
                  placeholder="Program description…"
                  minHeight={300}
                  context="document"
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
                <span className="pe-field__label">Special Notes</span>
                <span className="pe-field__help">Temporary logistical notes shown on the public program page — things like room changes, schedule adjustments, or one-time notices. Remove when no longer relevant.</span>
                <RimProseEditor
                  value={specialNotes}
                  onChange={(v: any) => { setSpecialNotes(v); markDirty(); }}
                  placeholder="Any temporary notes…"
                  minHeight={120}
                />
              </div>

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
              <span className="pe-field__help">How the schedule appears on the public site — auto-generated from your recurrence and start date. Clear it to regenerate, or type here to override.</span>
              <input type="text" value={dateText} onChange={(e) => setDateText(e.target.value)} className="pe-input" placeholder="e.g. Tuesdays and Thursdays" />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Time Label</span>
              <span className="pe-field__help">Shown on program cards and in confirmation emails — auto-generated from your start and end times. Clear to regenerate, or type to override.</span>
              <input type="text" value={timeText} onChange={(e) => setTimeText(e.target.value)} className="pe-input" placeholder="e.g. 7:00–8:30 PM CT" />
            </label>

            <fieldset className="pe-field">
              <legend className="pe-field__label">Program Format</legend>
              <span className="pe-field__help">In-person, virtual, or hybrid. This controls whether a LiveKit video room or a venue address is shown.</span>
              <div className="pe-radio-group">
                {["in-person", "virtual", "hybrid"].map((val) => (
                  <label key={val} className="pe-radio">
                    <input type="radio" checked={programFormat === val} onChange={() => setProgramFormat(val)} />
                    {val === "in-person" ? "In-person" : val === "virtual" ? "Virtual" : "Hybrid"}
                  </label>
                ))}
              </div>
            </fieldset>

            {programFormat !== "virtual" && (
              <fieldset className="pe-field">
                <legend className="pe-field__label">Venue</legend>
                <span className="pe-field__help">Where the program takes place. &lsquo;At RIM&rsquo; auto-fills the RIM address. &lsquo;Other&rsquo; lets you enter a custom location.</span>
                <div className="pe-radio-group">
                  <label className="pe-radio">
                    <input type="radio" checked={venue === "at-rim"} onChange={() => setVenue("at-rim")} />
                    At RIM
                  </label>
                  <label className="pe-radio">
                    <input type="radio" checked={venue === "other"} onChange={() => setVenue("other")} />
                    Other location
                  </label>
                </div>
              </fieldset>
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

                {isOpenAccess && isEditing && guestAccessKey && (
                  <div className="pe-open-access-link">
                    <span className="pe-field__label">Guest Link</span>
                    <div className="pe-open-access-link__box">
                      {typeof window !== "undefined" ? `${window.location.origin}/session/${slug}?key=${guestAccessKey}` : `/session/${slug}?key=${guestAccessKey}`}
                    </div>
                    <div className="pe-open-access-link__actions">
                      <button
                        type="button"
                        className="pe-btn pe-btn--small"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/session/${slug}?key=${guestAccessKey}`);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                      >
                        {copiedLink ? "Copied!" : "Copy Link"}
                      </button>
                      <button
                        type="button"
                        className="pe-btn pe-btn--small"
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
                      >
                        {resettingKey ? "Resetting…" : "Reset Link"}
                      </button>
                    </div>
                    <span className="pe-field__help">Resetting generates a new link and invalidates the previous one.</span>
                  </div>
                )}

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
              <DateTimePicker value={startDatetime} onChange={setStartDatetime} />
            </div>

            <div className="pe-field">
              <span className="pe-field__label">End Date &amp; Time</span>
              <DateTimePicker value={endDatetime} onChange={setEndDatetime} />
            </div>

            <fieldset className="pe-field">
              <legend className="pe-field__label">Recurrence</legend>
              <span className="pe-field__help">For repeating programs. Sets the pattern (weekly, daily, etc.) and how many times it occurs.</span>
              <div className="pe-radio-group">
                <label className="pe-radio">
                  <input type="radio" checked={!recurrenceFreq} onChange={() => setRecurrenceFreq("")} />
                  None (one-time)
                </label>
                {["DAILY", "WEEKLY", "MONTHLY"].map((val) => (
                  <label key={val} className="pe-radio">
                    <input type="radio" checked={recurrenceFreq === val} onChange={() => setRecurrenceFreq(val)} />
                    {val.charAt(0) + val.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
            </fieldset>

            {recurrenceFreq && (
              <label className="pe-field">
                <span className="pe-field__label">Repeat every</span>
                <div className="pe-inline-row">
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
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
                        onChange={() => setRecurrenceDays(toggleDay(recurrenceDays, d.value))}
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
          <div className="pe-card"><div className="pe-form">
            <div className="pe-field">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                />
                Registration enabled
              </label>
              <span className="pe-field__help">When checked, the public program page shows a registration form. When unchecked, visitors can read about the program but can&rsquo;t register.</span>
            </div>

            <div className="pe-field">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={registrationClosed}
                  onChange={(e) => setRegistrationClosed(e.target.checked)}
                />
                Registration closed
              </label>
              <span className="pe-field__help">Manually closes registration. The page shows a &lsquo;Registration is closed&rsquo; notice instead of the form.</span>
            </div>

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
              <RimProseEditor
                value={confirmationMessage}
                onChange={(v: any) => { setConfirmationMessage(v); markDirty(); }}
                placeholder="Optional custom message…"
                minHeight={120}
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
              <RimProseEditor
                value={reminderMessage}
                onChange={(v: any) => { setReminderMessage(v); markDirty(); }}
                placeholder="Optional reminder message…"
                minHeight={120}
              />
            </div>

          </div></div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 5 — Dana
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Dana" && (
          <div className="pe-card"><div className="pe-form">
            <fieldset className="pe-field">
              <legend className="pe-field__label">Dana Mode</legend>
              <span className="pe-field__help">How donations work for this program. &lsquo;Voluntary&rsquo; lets people give any amount. &lsquo;Base + Dana&rsquo; sets a minimum. &lsquo;Fixed&rsquo; sets an exact amount. &lsquo;None&rsquo; skips the donation step entirely.</span>
              <div className="pe-radio-group">
                {[
                  { value: "none", label: "None" },
                  { value: "voluntary", label: "Voluntary" },
                  { value: "base_plus_dana", label: "Base + Dana" },
                  { value: "fixed", label: "Fixed" },
                ].map((opt) => (
                  <label key={opt.value} className="pe-radio">
                    <input type="radio" checked={danaMode === opt.value} onChange={() => setDanaMode(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

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
                <label className="pe-field">
                  <span className="pe-field__label">Dana Step Message</span>
                  <span className="pe-field__help">Shown during the donation step of registration. Use this to explain how dana supports RIM.</span>
                  <textarea
                    value={danaMessage}
                    onChange={(e) => setDanaMessage(e.target.value)}
                    className="pe-textarea"
                    rows={3}
                  />
                </label>

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
           TAB 6 — Dashboard
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Dashboard" && (
          <div className="pe-card"><div className="pe-form">
            <label className="pe-field">
              <span className="pe-field__label">Special Announcement</span>
              <span className="pe-field__help">A bold notice shown on this program&rsquo;s dashboard card. Use for urgent or time-sensitive info like a schedule change.</span>
              <textarea
                value={specialAnnouncement}
                onChange={(e) => setSpecialAnnouncement(e.target.value)}
                className="pe-textarea"
                rows={2}
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Early Arrival Message</span>
              <span className="pe-field__help">A quieter message shown on the dashboard card — things like &lsquo;Please arrive 10 minutes early&rsquo; or &lsquo;Bring a cushion.&rsquo;</span>
              <textarea
                value={earlyArrivalMessage}
                onChange={(e) => setEarlyArrivalMessage(e.target.value)}
                className="pe-textarea"
                rows={2}
              />
            </label>

          </div></div>
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

            <div className="pe-field">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={hideFromProgramPageList}
                  onChange={(e) => setHideFromProgramPageList(e.target.checked)}
                />
                Hide from public Programs &amp; Events page
              </label>
              <span className="pe-field__help">When checked, this program won&rsquo;t appear on the public Programs &amp; Events listing. It&rsquo;s still accessible by direct URL.</span>
            </div>

            <div className="pe-field">
              <label className="pe-checkbox">
                <input
                  type="checkbox"
                  checked={removeFromProgramList}
                  onChange={(e) => setRemoveFromProgramList(e.target.checked)}
                />
                Hide from member dashboards
              </label>
              <span className="pe-field__help">When checked, this program won&rsquo;t appear on member dashboards. The program is still accessible by direct link and on the public site.</span>
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
