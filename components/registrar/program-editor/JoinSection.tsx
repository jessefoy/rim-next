"use client";

/** How people join: what visitors see, registration on or closed, open entry,
 *  places, the closing date, and the questions on the form. One of the
 *  program editor's seven sections. */

import { memo, useMemo, useState } from "react";
import { OFFERING_FORMATS, categorySectionTitle, isOfferingCategory } from "@/lib/programOffering";
import { onlinePhrase } from "@/lib/outsideMeeting";
import { DateTimePicker, EditorSection, type RegistrationField, type Setter } from "./shared";

interface Props {
  registrationEnabled: boolean;
  setRegistrationEnabled: Setter<boolean>;
  registrationClosed: boolean;
  setRegistrationClosed: Setter<boolean>;
  openEntry: boolean;
  setOpenEntry: Setter<boolean>;
  registrationCapacity: string;
  setRegistrationCapacity: Setter<string>;
  registrationDeadline: string;
  setRegistrationDeadline: Setter<string>;
  registrationFields: RegistrationField[];
  setRegistrationFields: Setter<RegistrationField[]>;
  /** Read here for the readout: how it meets, and its category and format. */
  programFormat: string;
  roomChoice: "rim" | "outside";
  outsideUrl: string;
  offeringCategory: string;
  offeringFormat: string;
  markDirty: () => void;
}

function JoinSection({
  registrationEnabled, setRegistrationEnabled,
  registrationClosed, setRegistrationClosed,
  openEntry, setOpenEntry,
  registrationCapacity, setRegistrationCapacity,
  registrationDeadline, setRegistrationDeadline,
  registrationFields, setRegistrationFields,
  programFormat, roomChoice, outsideUrl, offeringCategory, offeringFormat,
  markDirty,
}: Props) {
  // Raw string drafts for select option inputs — avoids split/join on every keystroke
  const [optionsDraft, setOptionsDraft] = useState<Record<number, string>>({});

  // ── "How this appears to visitors" ───────────────────────────────────────
  // Mirror the public program page's registration CTA so the volunteer sees the
  // consequence of these toggles at edit time (registration and Open entry).
  // Category and Format are labels and never change access.
  const isVirtual = programFormat === "virtual" || programFormat === "hybrid";
  // "on Zoom" / "on Google Meet" / "online": what this program meets on.
  const onlineWords = onlinePhrase({
    programFormat,
    outsideMeetingUrl: isVirtual && roomChoice === "outside" ? outsideUrl.trim() || null : null,
  });
  // What Open entry means for THIS program's delivery (matches Where it appears).
  const openEntryText = openEntry
    ? programFormat === "in-person"
      ? "Anyone may simply arrive in person, without registering. It carries the Drop-in mark on This Week."
      : programFormat === "hybrid"
        ? `Anyone may simply arrive in person, and anyone signed in may join ${onlineWords}, without registering. On the days it meets it appears on My Home’s Today for everyone (see Where it appears) and carries the Drop-in mark on This Week.`
        : `Anyone signed in may join ${onlineWords} without registering. On the days it meets it appears on My Home’s Today for everyone (see Where it appears) and carries the Drop-in mark on This Week.`
    : "People join by registering. Hosts and teachers always have access. It carries no Drop-in mark.";

  const appearanceText = useMemo(() => {
    const deadlinePast = registrationDeadline
      ? new Date(registrationDeadline) < new Date()
      : false;
    const regClosedEffective = registrationClosed || deadlinePast;
    return registrationEnabled
      ? regClosedEffective
        ? "Registration is closed — visitors see a “Registration is closed” notice instead of the form."
        : "Registration is open — visitors see a Register button (it automatically waitlists once you reach capacity)."
      : openEntry
        ? "Open entry: visitors see how to join (in person and/or online). No registration needed."
        : "Registration isn’t open yet — visitors are told that, with no sign-up button. Turn on “Registration enabled” below when you’re ready to take sign-ups.";
  }, [openEntry, registrationDeadline, registrationClosed, registrationEnabled]);

  // ── Registration fields management ───────────────────────────────────────
  // A click isn't a change event, so adding, removing and moving a question
  // mark the page unsaved themselves.
  function addField() {
    setRegistrationFields((prev) => [
      ...prev,
      { label: "", fieldType: "shortText", required: false, options: [] },
    ]);
    markDirty();
  }

  function updateField(idx: number, updates: Partial<RegistrationField>) {
    setRegistrationFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...updates } : f))
    );
  }

  function removeField(idx: number) {
    setRegistrationFields((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  }

  function moveField(idx: number, dir: -1 | 1) {
    setRegistrationFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    markDirty();
  }

  return (
    <EditorSection id="join">
      <div className="pe-form">
        {/* How this appears to visitors — reflects registration + Open entry
            so the volunteer sees the consequence of these toggles. Category
            and Format are shown as labels; they never change access. */}
        <div className="pe-readout">
          <p className="pe-readout__title">How this appears to visitors</p>
          <p className="pe-readout__row">{appearanceText}</p>
          <p className="pe-readout__row">
            <span className="pe-readout__state">Open entry: {openEntry ? "on" : "off"}.</span>{" "}
            {openEntryText}
          </p>
          {isOfferingCategory(offeringCategory) && (
            <p className="pe-readout__row pe-readout__row--meta">
              Category: {categorySectionTitle(offeringCategory)}
              {offeringFormat ? ` · Format: ${OFFERING_FORMATS.find((f) => f.code === offeringFormat)?.label ?? ""}` : ""}
            </p>
          )}
        </div>

        <div className="pe-visibility-option">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
            />
            <span className="pe-checkbox__label">Registration enabled</span>
          </label>
          <p className="pe-field__help">When checked, visitors get a registration form. When unchecked, the page shows how to join if Open entry is on, and otherwise &ldquo;Registration isn&rsquo;t open yet&rdquo; (see above).</p>
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

        <div className="pe-visibility-option">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={openEntry}
              onChange={(e) => setOpenEntry(e.target.checked)}
            />
            <span className="pe-checkbox__label">Open entry</span>
          </label>
          <p className="pe-field__help">Anyone signed in may join without registering: simply arrive for an in-person program, or join on Zoom for an online one. Online programs with open entry also appear on My Home&rsquo;s Today for everyone, and every program with open entry carries the Drop-in mark on This Week. A program can have registration and open entry together. This is the only setting that decides access: Category and Format are labels.</p>
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
          <DateTimePicker label="Registration deadline" value={registrationDeadline} onChange={setRegistrationDeadline} />
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
                  aria-label={`Question ${idx + 1}`}
                />
                <select
                  value={field.fieldType}
                  onChange={(e) => {
                    updateField(idx, { fieldType: e.target.value as RegistrationField["fieldType"] });
                    setOptionsDraft((prev) => { const next = { ...prev }; delete next[idx]; return next; });
                  }}
                  className="pe-select pe-select--narrow"
                  aria-label={`Kind of answer for question ${idx + 1}`}
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
                  aria-label={`Choices for question ${idx + 1}, separated by commas`}
                />
              )}
              <div className="pe-reg-field__actions">
                <button type="button" className="pe-btn pe-btn--small" onClick={() => moveField(idx, -1)} disabled={idx === 0} aria-label={`Move question ${idx + 1} up`}>↑</button>
                <button type="button" className="pe-btn pe-btn--small" onClick={() => moveField(idx, 1)} disabled={idx === registrationFields.length - 1} aria-label={`Move question ${idx + 1} down`}>↓</button>
                <button type="button" className="pe-btn pe-btn--small pe-btn--danger" onClick={() => removeField(idx)} aria-label={`Remove question ${idx + 1}`}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="pe-btn pe-btn--small" onClick={addField}>
            + Add Question
          </button>
        </div>
      </div>
    </EditorSection>
  );
}

export default memo(JoinSection);
