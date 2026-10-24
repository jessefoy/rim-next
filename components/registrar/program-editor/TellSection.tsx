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
  reminderMessage: string;
  setReminderMessage: Setter<string>;
  markDirty: () => void;
}

function TellSection({
  confirmationMessage, setConfirmationMessage,
  reminderDate, setReminderDate,
  reminderMessage, setReminderMessage,
  markDirty,
}: Props) {
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

        <div className="pe-field">
          <span className="pe-field__label">Reminder Date</span>
          <span className="pe-field__help">When set, a reminder email can be sent to all registered participants on or after this date.</span>
          <DateTimePicker label="Reminder date" value={reminderDate} onChange={setReminderDate} />
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

        <p className="pe-field__help">
          For a change people should know (&ldquo;Cancelled tonight&rdquo;), use Post a notice at the top of
          this page, once the program is saved.
        </p>
      </div>
    </EditorSection>
  );
}

export default memo(TellSection);
