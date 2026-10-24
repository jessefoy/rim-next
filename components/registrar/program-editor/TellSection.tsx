"use client";

/** What we tell them: the confirmation message, the reminder, and the notice.
 *  One of the program editor's seven sections. The notice moves to a "Post a
 *  notice" button at the top of the page in a later piece of Phase 2. */

import { memo } from "react";
import { DateTimePicker, EditorSection, RimTiptapEditor, type Setter } from "./shared";

interface Props {
  confirmationMessage: string;
  setConfirmationMessage: Setter<string>;
  reminderDate: string;
  setReminderDate: Setter<string>;
  reminderMessage: string;
  setReminderMessage: Setter<string>;
  specialAnnouncement: string;
  setSpecialAnnouncement: Setter<string>;
  announcementUntil: string;
  setAnnouncementUntil: Setter<string>;
  markDirty: () => void;
}

function TellSection({
  confirmationMessage, setConfirmationMessage,
  reminderDate, setReminderDate,
  reminderMessage, setReminderMessage,
  specialAnnouncement, setSpecialAnnouncement,
  announcementUntil, setAnnouncementUntil,
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

        <hr className="pe-section-divider" />

        <label className="pe-field">
          <span className="pe-field__label">Notice</span>
          <span className="pe-field__help">A change: &ldquo;Cancelled this week.&rdquo; &ldquo;Starting at 7:15 tonight.&rdquo; &ldquo;We are in the community room.&rdquo; Shown wherever the program is listed: Programs &amp; Events, This Week, the program&rsquo;s page, and My Home.</span>
          <textarea
            value={specialAnnouncement}
            onChange={(e) => { setSpecialAnnouncement(e.target.value); markDirty(); }}
            className="pe-textarea"
            rows={2}
          />
        </label>

        <label className="pe-field">
          <span className="pe-field__label">Show until</span>
          <span className="pe-field__help">The last day the notice shows; it clears itself the next morning. Leave empty and it stays until you clear the text.</span>
          <input
            type="date"
            value={announcementUntil}
            onChange={(e) => { setAnnouncementUntil(e.target.value); markDirty(); }}
            className="pe-input pe-input--narrow"
          />
        </label>
      </div>
    </EditorSection>
  );
}

export default memo(TellSection);
