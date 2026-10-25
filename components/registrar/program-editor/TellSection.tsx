"use client";

/** What we tell them: the confirmation message and the reminder. One of the
 *  program editor's seven sections. A notice is posted with Post a notice at
 *  the top of the page, apart from Save (2026-10-24). */

import { memo } from "react";
import { DateTimePicker, EditorSection, RimTiptapEditor, type Setter } from "./shared";

interface Props {
  confirmationMessage: string;
  setConfirmationMessage: Setter<string>;
  reminderDate: string;
  setReminderDate: Setter<string>;
  /** Days before the first session, as typed, or "" (lib/reminderSchedule.ts). */
  reminderDaysBefore: string;
  setReminderDaysBefore: Setter<string>;
  /** The first session, a Central "YYYY-MM-DDTHH:mm", to say when it goes. */
  startDatetime: string;
  /** For the note after: the program's last day, and whether it repeats. */
  endDatetime: string;
  recurrenceFreq: string;
  followUpEnabled: boolean;
  setFollowUpEnabled: Setter<boolean>;
  followUpMessage: string;
  setFollowUpMessage: Setter<string>;
  /** The timing chosen here, kept while its box is emptied (Save checks it). */
  reminderModePicked: "days" | "date" | "none" | null;
  setReminderModePicked: Setter<"days" | "date" | "none" | null>;
  reminderMessage: string;
  setReminderMessage: Setter<string>;
  markDirty: () => void;
}

function TellSection({
  confirmationMessage, setConfirmationMessage,
  reminderDate, setReminderDate,
  reminderDaysBefore, setReminderDaysBefore, startDatetime,
  reminderModePicked, setReminderModePicked,
  endDatetime, recurrenceFreq,
  followUpEnabled, setFollowUpEnabled,
  followUpMessage, setFollowUpMessage,
  reminderMessage, setReminderMessage,
  markDirty,
}: Props) {
  // The reminder's timing (lib/reminderSchedule.ts): days before wins when
  // both are set, so choosing one clears the other.
  // A choice made here stays while its box is emptied to retype it.
  const mode: "days" | "date" | "none" =
    reminderModePicked ?? (reminderDaysBefore.trim() !== "" ? "days" : reminderDate ? "date" : "none");
  function chooseMode(next: "days" | "date" | "none") {
    setReminderModePicked(next);
    if (next === "days") {
      setReminderDaysBefore((v) => (v.trim() !== "" ? v : "2"));
      setReminderDate("");
    } else if (next === "date") {
      setReminderDaysBefore("");
    } else {
      setReminderDaysBefore("");
      setReminderDate("");
    }
    markDirty();
  }
  // The note after: the Central day after the program's last day.
  const lastDay = (endDatetime || startDatetime).slice(0, 10);
  const afterDay = lastDay
    ? (() => {
        const d = new Date(`${lastDay}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
      })()
    : null;
  // "Thursday, November 12": the Central day it first goes out.
  const n = Number(reminderDaysBefore);
  const sendDay =
    mode === "days" && startDatetime && Number.isInteger(n) && n >= 1
      ? (() => {
          const d = new Date(`${startDatetime.slice(0, 10)}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - n);
          return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
        })()
      : null;

  return (
    <EditorSection id="tell">
      <div className="pe-form">
        <div className="pe-field">
          <span className="pe-field__label">Confirmation Message</span>
          <span className="pe-field__help">
            Shown in the confirmation email after someone registers: what to
            bring, how to prepare, directions, or a link to a class handout.
            <strong> To add a link:</strong> type the words people will
            click (such as &ldquo;Our class handout&rdquo;), select them, then
            click the chain button in the small bar that appears above them.
            Paste the address and click OK. For a Google Doc, first set its
            sharing to &ldquo;Anyone with the link&rdquo; can view, or
            registrants will be asked to request access.
          </span>
          <RimTiptapEditor
            value={confirmationMessage}
            onChange={(v) => { setConfirmationMessage(v); markDirty(); }}
            placeholder="Optional custom message…"
            variant="message"
          />
        </div>

        <fieldset className="pe-field">
          <legend className="pe-field__label">The reminder</legend>
          <div className="pe-option-cards">
            {([
              { value: "days", label: "Days before it begins" },
              { value: "date", label: "On a set date" },
              { value: "none", label: "No reminder" },
            ] as const).map((opt) => (
              <label key={opt.value} className={`pe-option-card${mode === opt.value ? " pe-option-card--active" : ""}`}>
                <input type="radio" name="reminderMode" checked={mode === opt.value} onChange={() => chooseMode(opt.value)} />
                <span className="pe-option-card__mark" />
                {opt.label}
              </label>
            ))}
          </div>
          {mode === "days" && (
            <div className="pe-field" style={{ marginTop: 12 }}>
              <label className="pe-inline-row">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={reminderDaysBefore}
                  onChange={(e) => setReminderDaysBefore(e.target.value)}
                  className="pe-input pe-input--narrow"
                  aria-label="Days before the first session"
                />
                <span>days before the first session</span>
              </label>
              <span className="pe-field__help">
                {sendDay
                  ? `It goes out on ${sendDay}, in the morning, to everyone registered, and each morning after to anyone who registers later, until it begins.`
                  : startDatetime
                    ? "It goes out that many days before the first session, in the morning, and to anyone who registers later, until it begins."
                    : "Nothing goes out until the first session is set, under When and where."}{" "}
                A program with several sessions is reminded once, before the first.
              </span>
            </div>
          )}
          {mode === "date" && (
            <div className="pe-field" style={{ marginTop: 12 }}>
              <span className="pe-field__help">The reminder email goes out on this day, in the morning, to everyone registered by then. The registration team can also send it early, in Registration.</span>
              <DateTimePicker label="Reminder date" value={reminderDate} onChange={setReminderDate} />
            </div>
          )}
        </fieldset>

        <div className="pe-field">
          <span className="pe-field__label">Reminder Message</span>
          <span className="pe-field__help">What the reminder email says.</span>
          <RimTiptapEditor
            value={reminderMessage}
            onChange={(v) => { setReminderMessage(v); markDirty(); }}
            placeholder="Optional reminder message…"
            variant="message"
          />
        </div>

        <fieldset className="pe-field">
          <legend className="pe-field__label">After it ends</legend>
          {recurrenceFreq ? (
            <span className="pe-field__help">A note after is for one-time programs: a program that repeats doesn&rsquo;t end.</span>
          ) : (
            <>
              <label className="pe-checkbox">
                <input type="checkbox" checked={followUpEnabled} onChange={(e) => { setFollowUpEnabled(e.target.checked); markDirty(); }} />
                <span>Send a note the day after</span>
              </label>
              <span className="pe-field__help">
                {afterDay
                  ? `It goes out on ${afterDay}, in the morning, to everyone who had a place.`
                  : "It goes out the morning after the program ends, to everyone who had a place."}{" "}
                A thank-you, a reading, a word about what comes next.
              </span>
              {followUpEnabled && (
                <RimTiptapEditor
                  value={followUpMessage}
                  onChange={(v) => { setFollowUpMessage(v); markDirty(); }}
                  placeholder="The note…"
                  variant="message"
                />
              )}
            </>
          )}
        </fieldset>

        <p className="pe-field__help">
          For a change people should know (&ldquo;Cancelled tonight&rdquo;), use Post a notice at the top of
          this page, once the program is saved.
        </p>
      </div>
    </EditorSection>
  );
}

export default memo(TellSection);
