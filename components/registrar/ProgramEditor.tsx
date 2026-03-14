"use client";

/**
 * ProgramEditor — six-tab form for creating and editing programs.
 * Mirrors the Sanity Studio tab layout so LoriLee's muscle memory transfers.
 *
 * CSS prefix: pe-
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { upload } from "@vercel/blob/client";
import CreateMeetButton from "@/components/registrar/CreateMeetButton";

const ContentEditor = dynamic(() => import("@/components/ContentEditor"), { ssr: false });
const FormattedEditor = dynamic(() => import("@/components/FormattedEditor"), { ssr: false });

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
  categoryId: string;
  dateText: string;
  programFormat: string;
  venue: string;
  locationText: string;
  locationLink: string;
  zoomLink: string;
  meetHostAccount: string;
  calendarEventId: string;
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
}

interface Props {
  hubSlug: string;
  initialData?: ProgramData;
  isEditing: boolean;
  categories: Category[];
}

const TABS = ["Content", "Schedule", "Registration", "Dana", "Dashboard", "Visibility"] as const;
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProgramEditor({ hubSlug, initialData, isEditing, categories }: Props) {
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

  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [dateText, setDateText] = useState(initialData?.dateText ?? "");
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

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditing && !slugTouched && name) {
      setSlug(slugify(name));
    }
  }, [name, isEditing, slugTouched]);

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
        categoryId: categoryId || null,
        dateText,
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
        dayOfWeek,
        sortOrder: sortOrder ? Number(sortOrder) : null,
        removeFromProgramList,
        hideFromProgramPageList,
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
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        // If slug changed, redirect to new URL
        if (slug !== initialData?.slug) {
          router.push(`/account/hub/${hubSlug}/programs/${slug}/edit`);
        }
      } else {
        const created = await res.json();
        router.push(`/account/hub/${hubSlug}/programs/${created.slug}/edit`);
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
    <div className="pe-editor">
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

      <div className="pe-form">

        {/* ══════════════════════════════════════════════════════════════════
           TAB 1 — Content
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Content" && (
          <>
            <label className="pe-field">
              <span className="pe-field__label">Name *</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="pe-input" required />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Slug *</span>
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
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="pe-input" />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Program Image</span>
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

            <div className="pe-field">
              <span className="pe-field__label">Description</span>
              <ContentEditor
                value={description}
                onChange={setDescription}
                placeholder="Program description…"
                minHeight={300}
              />
            </div>

            <label className="pe-field">
              <span className="pe-field__label">Pull Quote</span>
              <input type="text" value={pullQuote} onChange={(e) => setPullQuote(e.target.value)} className="pe-input" />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Pull Quote Source</span>
              <input type="text" value={pullQuoteSource} onChange={(e) => setPullQuoteSource(e.target.value)} className="pe-input" />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Special Notes</span>
              <span className="pe-field__help">Temporary logistical notices displayed on the program page.</span>
              <FormattedEditor
                value={specialNotes}
                onChange={setSpecialNotes}
                placeholder="Any temporary notes…"
                minHeight={120}
              />
            </div>

            <label className="pe-field">
              <span className="pe-field__label">Teacher / Facilitators</span>
              <span className="pe-field__help">Comma-separated names.</span>
              <input
                type="text"
                value={teacherFacilitatorsText}
                onChange={(e) => setTeacherFacilitatorsText(e.target.value)}
                className="pe-input"
                placeholder="Jesse Foy, LoriLee Villwock"
              />
            </label>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 2 — Schedule & Location
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Schedule" && (
          <>
            <label className="pe-field">
              <span className="pe-field__label">Category</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="pe-select">
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Date & Time Label (override)</span>
              <span className="pe-field__help">Leave blank to auto-generate from the schedule fields below.</span>
              <input type="text" value={dateText} onChange={(e) => setDateText(e.target.value)} className="pe-input" />
            </label>

            <fieldset className="pe-field">
              <legend className="pe-field__label">Program Format</legend>
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
                  <input type="text" value={locationText} onChange={(e) => setLocationText(e.target.value)} className="pe-input" />
                </label>
                <label className="pe-field">
                  <span className="pe-field__label">Location Link</span>
                  <input type="url" value={locationLink} onChange={(e) => setLocationLink(e.target.value)} className="pe-input" placeholder="https://…" />
                </label>
              </>
            )}

            <label className="pe-field">
              <span className="pe-field__label">Start Date & Time</span>
              <input type="datetime-local" value={startDatetime} onChange={(e) => setStartDatetime(e.target.value)} className="pe-input" />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">End Date & Time</span>
              <input type="datetime-local" value={endDatetime} onChange={(e) => setEndDatetime(e.target.value)} className="pe-input" />
            </label>

            <fieldset className="pe-field">
              <legend className="pe-field__label">Recurrence</legend>
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

            {/* Google Meet section */}
            {isVirtual && isEditing && (
              <div className="pe-meet-section">
                <CreateMeetButton
                  programSlug={slug}
                  existingLink={initialData?.zoomLink ?? null}
                  existingHostAccount={initialData?.meetHostAccount ?? null}
                  hasStartDatetime={!!startDatetime}
                />
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 3 — Registration
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Registration" && (
          <>
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={registrationEnabled}
                onChange={(e) => setRegistrationEnabled(e.target.checked)}
              />
              Registration enabled
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={registrationClosed}
                onChange={(e) => setRegistrationClosed(e.target.checked)}
              />
              Registration closed
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Capacity</span>
              <input
                type="number"
                min="1"
                value={registrationCapacity}
                onChange={(e) => setRegistrationCapacity(e.target.value)}
                className="pe-input pe-input--narrow"
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Registration Deadline</span>
              <input
                type="datetime-local"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="pe-input"
              />
            </label>

            {/* Custom questions builder */}
            <div className="pe-field">
              <span className="pe-field__label">Custom Questions</span>
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
                      onChange={(e) => updateField(idx, { fieldType: e.target.value as RegistrationField["fieldType"] })}
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
                      value={field.options.join(", ")}
                      onChange={(e) =>
                        updateField(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                      }
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
              <span className="pe-field__help">Custom message included in the confirmation email.</span>
              <FormattedEditor
                value={confirmationMessage}
                onChange={setConfirmationMessage}
                placeholder="Optional custom message…"
                minHeight={120}
              />
            </div>

            <label className="pe-field">
              <span className="pe-field__label">Reminder Date</span>
              <span className="pe-field__help">Reminder emails send at 9am Central on this date.</span>
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="pe-input"
              />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Reminder Message</span>
              <span className="pe-field__help">Custom message included in the reminder email.</span>
              <FormattedEditor
                value={reminderMessage}
                onChange={setReminderMessage}
                placeholder="Optional reminder message…"
                minHeight={120}
              />
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 4 — Dana
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Dana" && (
          <>
            <fieldset className="pe-field">
              <legend className="pe-field__label">Dana Mode</legend>
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
                <span className="pe-field__label">Suggested Dana ($)</span>
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
                  <span className="pe-field__help">Shown on the dana step of the registration form.</span>
                  <textarea
                    value={danaMessage}
                    onChange={(e) => setDanaMessage(e.target.value)}
                    className="pe-textarea"
                    rows={3}
                  />
                </label>

                <label className="pe-field">
                  <span className="pe-field__label">Program Page Dana Note</span>
                  <span className="pe-field__help">Shown on the public program page.</span>
                  <textarea
                    value={danaText}
                    onChange={(e) => setDanaText(e.target.value)}
                    className="pe-textarea"
                    rows={2}
                  />
                </label>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 5 — Dashboard
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Dashboard" && (
          <>
            <label className="pe-field">
              <span className="pe-field__label">Special Announcement</span>
              <span className="pe-field__help">Bold notice shown on the member dashboard card.</span>
              <textarea
                value={specialAnnouncement}
                onChange={(e) => setSpecialAnnouncement(e.target.value)}
                className="pe-textarea"
                rows={2}
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Early Arrival Message</span>
              <span className="pe-field__help">Muted guidance shown on dashboard card.</span>
              <textarea
                value={earlyArrivalMessage}
                onChange={(e) => setEarlyArrivalMessage(e.target.value)}
                className="pe-textarea"
                rows={2}
              />
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={hideFromDashboard}
                onChange={(e) => setHideFromDashboard(e.target.checked)}
              />
              Hide from member dashboard
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Day of Week</span>
              <span className="pe-field__help">Drives the &quot;Today&quot; badge and day-based grouping on the dashboard.</span>
              <div className="pe-day-grid">
                {DAY_OPTIONS.map((d) => (
                  <label key={d.value} className="pe-day-toggle">
                    <input
                      type="checkbox"
                      checked={dayOfWeek.includes(d.value)}
                      onChange={() => setDayOfWeek(toggleDay(dayOfWeek, d.value))}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TAB 6 — Visibility
           ══════════════════════════════════════════════════════════════════ */}
        {tab === "Visibility" && (
          <>
            <label className="pe-field">
              <span className="pe-field__label">Sort Order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="pe-input pe-input--narrow"
              />
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={hideFromProgramPageList}
                onChange={(e) => setHideFromProgramPageList(e.target.checked)}
              />
              Hide from public Programs &amp; Events page
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={removeFromProgramList}
                onChange={(e) => setRemoveFromProgramList(e.target.checked)}
              />
              Hide from member dashboard program list
            </label>
          </>
        )}

      </div>

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
          onClick={() => router.push(`/account/hub/${hubSlug}/programs`)}
          className="pe-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
