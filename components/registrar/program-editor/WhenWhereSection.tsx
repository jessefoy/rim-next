"use client";

/** When and where: how it meets, the place, the dates and repeats, the session
 *  note, and for online programs the room, who can join, recording and the
 *  guest link. One of the program editor's seven sections. */

import { memo, useState } from "react";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { EARLY_OPEN_MIN, LATE_GRACE_MIN } from "@/lib/sessionWindowConstants";
import { DateTimePicker, EditorSection, type Setter } from "./shared";

const DAY_OPTIONS = [
  { value: "SU", label: "Sun" },
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
];

interface Props {
  isEditing: boolean;
  canManage: boolean;
  /** The program's address as saved: the guest link and its reset use it,
   *  not an unsaved edit of the slug. */
  savedSlug: string;
  programFormat: string;
  setProgramFormat: Setter<string>;
  venue: string;
  setVenue: Setter<string>;
  locationText: string;
  setLocationText: Setter<string>;
  locationLink: string;
  setLocationLink: Setter<string>;
  earlyArrivalMessage: string;
  setEarlyArrivalMessage: Setter<string>;
  startDatetime: string;
  setStartDatetime: Setter<string>;
  endDatetime: string;
  setEndDatetime: Setter<string>;
  recurrenceFreq: string;
  setRecurrenceFreq: Setter<string>;
  recurrenceInterval: string;
  setRecurrenceInterval: Setter<string>;
  recurrenceDays: string[];
  setRecurrenceDays: Setter<string[]>;
  recurrenceCount: string;
  setRecurrenceCount: Setter<string>;
  dateText: string;
  timeText: string;
  roomChoice: "rim" | "outside";
  setRoomChoice: Setter<"rim" | "outside">;
  outsideUrl: string;
  setOutsideUrl: Setter<string>;
  outsideUrlError: string;
  setOutsideUrlError: Setter<string>;
  outsidePublic: boolean;
  setOutsidePublic: Setter<boolean>;
  /** Read here, set under How people join and Who's helping. */
  registrationEnabled: boolean;
  openEntry: boolean;
  noHostNeeded: boolean;
  recordByDefault: boolean;
  setRecordByDefault: Setter<boolean>;
  isOpenAccess: boolean;
  setIsOpenAccess: Setter<boolean>;
  guestAccessKey: string;
  setGuestAccessKey: Setter<string>;
  markDirty: () => void;
}

function WhenWhereSection({
  isEditing, canManage, savedSlug,
  programFormat, setProgramFormat,
  venue, setVenue,
  locationText, setLocationText,
  locationLink, setLocationLink,
  earlyArrivalMessage, setEarlyArrivalMessage,
  startDatetime, setStartDatetime,
  endDatetime, setEndDatetime,
  recurrenceFreq, setRecurrenceFreq,
  recurrenceInterval, setRecurrenceInterval,
  recurrenceDays, setRecurrenceDays,
  recurrenceCount, setRecurrenceCount,
  dateText, timeText,
  roomChoice, setRoomChoice,
  outsideUrl, setOutsideUrl,
  outsideUrlError, setOutsideUrlError,
  outsidePublic, setOutsidePublic,
  registrationEnabled, openEntry, noHostNeeded,
  recordByDefault, setRecordByDefault,
  isOpenAccess, setIsOpenAccess,
  guestAccessKey, setGuestAccessKey,
  markDirty,
}: Props) {
  const [resettingKey, setResettingKey] = useState(false);
  const [confirmResetKey, setConfirmResetKey] = useState(false);
  const [resetKeyNote, setResetKeyNote] = useState<{ tone: "ok" | "error"; msg: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isVirtual = programFormat === "virtual" || programFormat === "hybrid";
  // The program page offers its own Join (same rule as the page and /enter).
  const publicJoinOn = isVirtual && roomChoice === "outside" && outsidePublic && !registrationEnabled;
  const toggleDay = (arr: string[], day: string) =>
    arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day];

  return (
    <EditorSection id="when">
      <div className="pe-form">
        <div className="pe-field">
          <span className="pe-field__label">Program Format</span>
          <span className="pe-field__help">In-person, virtual, or hybrid. Virtual and hybrid programs meet on RIM&rsquo;s Zoom, or in an outside meeting set below; in-person and hybrid programs show the venue address.</span>
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
              <span className="pe-field__help">A link to the venue: Google Maps, a website, or directions. Shown as a clickable link on the program page, and as &ldquo;Map and directions&rdquo; in the confirmation email.</span>
              <input type="url" value={locationLink} onChange={(e) => setLocationLink(e.target.value)} className="pe-input" placeholder="https://…" />
            </label>
          </>
        )}

        <div className="pe-field">
          <span className="pe-field__label">Start Date &amp; Time</span>
          <span className="pe-field__help">The date range for this program. For single-day events, set both to the same date.</span>
          <DateTimePicker label="Start date and time" value={startDatetime} onChange={(v) => { setStartDatetime(v); markDirty(); }} />
        </div>

        <div className="pe-field">
          <span className="pe-field__label">End Date &amp; Time</span>
          <DateTimePicker label="End date and time" value={endDatetime} onChange={(v) => { setEndDatetime(v); markDirty(); }} />
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

        <label className="pe-field">
          <span className="pe-field__label">Schedule Label</span>
          <span className="pe-field__help">How the schedule appears on the public site. It&rsquo;s made from the recurrence and start date; change those above to update it.</span>
          <input type="text" value={dateText} readOnly className="pe-input pe-input--readonly" />
        </label>

        <label className="pe-field">
          <span className="pe-field__label">Time Label</span>
          <span className="pe-field__help">Shown on program cards and in confirmation emails. It&rsquo;s made from the start and end times; change those above to update it.</span>
          <input type="text" value={timeText} readOnly className="pe-input pe-input--readonly" />
        </label>

        <label className="pe-field">
          <span className="pe-field__label">Session note</span>
          <span className="pe-field__help">One quiet line shown with the session on My Home on the day: &ldquo;Held in noble silence before and during the session.&rdquo; &ldquo;Doors open ten minutes before.&rdquo; &ldquo;Bring a cushion.&rdquo;</span>
          <textarea
            value={earlyArrivalMessage}
            onChange={(e) => setEarlyArrivalMessage(e.target.value)}
            className="pe-textarea"
            rows={2}
          />
        </label>

        {/* ── Where it meets online (2026-10-14) ────────────────────────
            RIM's Zoom, or someone else's room. The readout beneath says,
            for the settings chosen, who can get in and how. */}
        {isVirtual && (
          <fieldset className="pe-field">
            <legend className="pe-field__label">Where it meets online</legend>
            <span className="pe-field__help">
              Choose RIM&rsquo;s Zoom for most programs. Choose an outside
              meeting link if the program meets in someone else&rsquo;s
              Zoom, like Recovery Dharma.
            </span>
            <div className="pe-option-cards">
              {([
                { value: "rim", label: "RIM’s Zoom" },
                { value: "outside", label: "An outside meeting link" },
              ] as const).map((opt) => (
                <label key={opt.value} className={`pe-option-card${roomChoice === opt.value ? " pe-option-card--active" : ""}`}>
                  <input
                    type="radio"
                    name="roomChoice"
                    checked={roomChoice === opt.value}
                    onChange={() => { setRoomChoice(opt.value); setOutsideUrlError(""); markDirty(); }}
                  />
                  <span className="pe-option-card__mark" />
                  {opt.label}
                </label>
              ))}
            </div>

            {roomChoice === "outside" && (
              // pe-field stacks the label above its help, as every other field does
              // ("Meeting link" ran into its help text inline).
              <div className="pe-field" style={{ marginTop: 16 }}>
                <label htmlFor="pe-outside-url" className="pe-field__label">Meeting link</label>
                <span className="pe-field__help" id="pe-outside-url-help">
                  Paste the full link here, passcode and all.
                </span>
                <input
                  id="pe-outside-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  className="pe-input"
                  placeholder="https://us06web.zoom.us/j/…"
                  value={outsideUrl}
                  aria-invalid={outsideUrlError ? true : undefined}
                  aria-describedby={outsideUrlError ? "pe-outside-url-help pe-outside-url-error" : "pe-outside-url-help"}
                  onChange={(e) => { setOutsideUrl(e.target.value); if (outsideUrlError) setOutsideUrlError(""); markDirty(); }}
                  onBlur={() => {
                    const check = cleanOutsideMeetingUrl(outsideUrl);
                    setOutsideUrlError(check.ok ? "" : check.error);
                  }}
                />
                {outsideUrlError && (
                  <p className="pe-field__error" id="pe-outside-url-error" role="alert">{outsideUrlError}</p>
                )}

                <label className="pe-checkbox" style={{ marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={outsidePublic && !registrationEnabled}
                    disabled={registrationEnabled}
                    aria-describedby="pe-outside-public-help"
                    onChange={(e) => { setOutsidePublic(e.target.checked); markDirty(); }}
                  />
                  <span>Anyone may join from the public program page</span>
                </label>
                <span className="pe-field__help" id="pe-outside-public-help">
                  {registrationEnabled
                    ? "To use this, turn off registration under How people join."
                    : "Check this if people without a RIM account should be able to join from the program page."}
                </span>
              </div>
            )}

            <div className="pe-readout" aria-live="polite" style={{ marginTop: 16 }}>
              <p className="pe-readout__title">Who can join, with these settings</p>
              {roomChoice === "rim" ? (
                <p className="pe-readout__row">
                  RIM opens a Zoom meeting for each session.
                </p>
              ) : (
                <p className="pe-readout__row">
                  Join takes everyone to this link, hosts and teachers too.
                </p>
              )}
              <p className="pe-readout__row">
                <span className="pe-readout__place">Members: </span>
                {openEntry
                  ? "anyone signed in, from My Home (Member area)."
                  : registrationEnabled
                    ? "people who registered, from My Home (Member area)."
                    : publicJoinOn
                      ? "anyone, from the program page."
                      : "no one yet. Turn on registration or Open entry under How people join."}
              </p>
              <p className="pe-readout__row">
                <span className="pe-readout__place">Guests: </span>
                {publicJoinOn
                  ? isOpenAccess
                    ? "anyone, from the program page or the guest link."
                    : "anyone, from the program page."
                  : isOpenAccess
                    ? "anyone you send the guest link."
                    : "no one. Turn on the guest link below to let guests in."}
              </p>
              {roomChoice === "outside" && (
                <p className="pe-readout__row">
                  <span className="pe-readout__place">Program page: </span>
                  {publicJoinOn
                    ? "a Join button for anyone."
                    : registrationEnabled
                      ? "a Register button."
                      : "no Join button."}
                </p>
              )}
              <p className="pe-readout__row pe-readout__row--meta">
                Join opens {EARLY_OPEN_MIN} minutes before each session and
                closes {LATE_GRACE_MIN} minutes after.
                {roomChoice === "outside" &&
                  " Anyone who already has the outside link can still use it whenever the room’s owner allows."}
              </p>
              {roomChoice === "outside" && !noHostNeeded && (
                <p className="pe-readout__row pe-readout__row--meta">
                  Check &ldquo;No host needed&rdquo; under Teachers and teams if
                  this program doesn&rsquo;t need a RIM host.
                </p>
              )}
            </div>
          </fieldset>
        )}

        {/* Recording is a setting on RIM's own Zoom meetings, so it only
            exists for programs that meet online in RIM's Zoom. */}
        {isVirtual && roomChoice === "rim" && (
          <div className="pe-field">
            <span className="pe-field__label">Recording</span>
            <span className="pe-field__help">
              Auto-record this program&rsquo;s sessions to the cloud for internal
              use. Participants see Zoom&rsquo;s recording indicator. Audio-only
              (and per-speaker tracks) depend on the Zoom account&rsquo;s
              recording settings. A change applies to upcoming sessions.
            </span>
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={recordByDefault}
                onChange={(e) => { setRecordByDefault(e.target.checked); markDirty(); }}
              />
              <span>Record sessions (audio-only)</span>
            </label>
          </div>
        )}

        {/* ── Open Access guest link ────── */}
        {isVirtual && (
          <fieldset className="pe-field">
            <legend className="pe-field__label">Open Access</legend>
            <span className="pe-field__help">Virtual/hybrid only. A RIM link you can share with people who have no RIM account: it takes anyone who holds it into this program&rsquo;s meeting (RIM&rsquo;s Zoom or the outside room) without registering or signing in, around session times only. Good for drop-in sessions, or a group the facilitator also serves.</span>
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={isOpenAccess}
                onChange={(e) => { setIsOpenAccess(e.target.checked); markDirty(); }}
              />
              <span>Enable guest access link</span>
            </label>

            {isOpenAccess && isEditing && guestAccessKey && (() => {
              const guestUrl = typeof window !== "undefined"
                ? `${window.location.origin}/session/${savedSlug}?key=${guestAccessKey}`
                : `/session/${savedSlug}?key=${guestAccessKey}`;
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
                      aria-label="Guest access link"
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
                  {/* Reset row: asks first, then answers beside the button. */}
                  {!canManage ? null : confirmResetKey ? (
                    <div style={{ marginTop: 8 }}>
                      <p className="pe-field__help" style={{ margin: "0 0 8px" }}>
                        Reset the guest link? The old link will stop working right away, so anyone you
                        shared it with will need the new one.
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="pe-btn pe-btn--small pe-btn--danger"
                          disabled={resettingKey}
                          onClick={async () => {
                            setResettingKey(true);
                            setResetKeyNote(null);
                            try {
                              const res = await fetch(`/api/programs-pg/${savedSlug}/guest-key`, { method: "POST" });
                              const data = await res.json().catch(() => ({}));
                              if (res.ok && data.guestAccessKey) {
                                setGuestAccessKey(data.guestAccessKey);
                                setResetKeyNote({ tone: "ok", msg: "The old link no longer works. Share the new one." });
                                setConfirmResetKey(false);
                              } else {
                                setResetKeyNote({ tone: "error", msg: "The link wasn't reset, so the old one still works. Please try again." });
                              }
                            } catch {
                              setResetKeyNote({ tone: "error", msg: "The link wasn't reset, so the old one still works. Please check your connection and try again." });
                            } finally {
                              setResettingKey(false);
                            }
                          }}
                        >
                          {resettingKey ? "Resetting…" : "Yes, reset the link"}
                        </button>
                        <button
                          type="button"
                          className="pe-btn pe-btn--small pe-btn--ghost"
                          disabled={resettingKey}
                          onClick={() => { setConfirmResetKey(false); setResetKeyNote(null); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setConfirmResetKey(true); setResetKeyNote(null); }}
                        style={{
                          background: "none", border: "none", padding: 0,
                          fontSize: "var(--text-xs)", color: "var(--rim-text-muted)", cursor: "pointer",
                          textDecoration: "underline", fontFamily: "var(--font-sans)",
                        }}
                      >
                        Reset link
                      </button>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--rim-text-muted)" }}>This stops the old link from working.</span>
                    </div>
                  )}
                  <p className={`save-note${resetKeyNote?.tone === "ok" ? " save-note--saved" : ""}`} role="status">
                    {resetKeyNote?.tone === "ok" ? resetKeyNote.msg : ""}
                  </p>
                  {resetKeyNote?.tone === "error" && (
                    <p className="save-note save-note--error" role="alert">{resetKeyNote.msg}</p>
                  )}
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
      </div>
    </EditorSection>
  );
}

export default memo(WhenWhereSection);
