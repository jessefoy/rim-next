"use client";

/**
 * Send an update to the people registered (2026-10-24, Phase 4 slice 3): after
 * a save changes the time, the place or the confirmation message of a program
 * people have registered for, the save route offers a drafted update
 * (lib/programUpdate.ts). Shown under the Save bar. Sent through
 * Registration's Message people, so it's kept in History. Someone who can't
 * open Registration sees only that the people registered haven't heard.
 * Its fields carry data-pe-separate, so typing here never marks the program
 * unsaved.
 */

import { memo, useState } from "react";
import { SaveNote } from "@/components/FormDone";
import { composeUpdate, kindsInWords, MESSAGE_MAX_PEOPLE, type UpdateKind } from "@/lib/programUpdate";

export interface UpdateOffer {
  kinds: UpdateKind[];
  /** People with a place; null when this person can't send it. */
  count: number | null;
  lines: Partial<Record<UpdateKind, string>>;
  programName: string;
  /** Which save this is, so a draft they've rewritten can say a later save changed more. */
  seq: number;
}

interface Props {
  slug: string;
  offer: UpdateOffer;
  /** Closed, or sent (with what to say). */
  onDone: (answer: string | null) => void;
}

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

function UpdatePanel({ slug, offer, onDone }: Props) {
  const draft = composeUpdate(offer.programName, offer.lines);
  // What they've written over the draft; until then the draft follows the saves.
  const [subject, setSubject] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The save their own words were written after.
  const [writtenAt, setWrittenAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState("");

  const changed = kindsInWords(offer.kinds);
  const subj = subject ?? draft.subject;
  const msg = message ?? draft.message;

  if (offer.count === null) {
    return (
      <div className="pe-update" id="pe-update" data-pe-separate role="status">
        <p className="pe-update__text">
          You changed {changed}. People have registered, and they won&rsquo;t hear about it unless the
          registration team sends them an update.
        </p>
        <div className="pe-notice__actions">
          <button type="button" className="pe-btn" onClick={() => onDone(null)}>Close</button>
        </div>
      </div>
    );
  }

  async function send(test: boolean) {
    if (!subj.trim() || !msg.trim()) {
      setProblem("Write a subject and a message.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/programs/${slug}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "registered", subject: subj, message: msg, test }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(json.error || "It wasn't sent. Please try again.");
        setStatus("error");
        setConfirming(false);
        return;
      }
      if (test) {
        setAnswer(`A test went to ${json.email}.`);
        setStatus("saved");
        return;
      }
      onDone(`The update is going to ${people(json.count)} now, one at a time. It’s kept in Registration’s History.`);
    } catch {
      // The send may have gone through before the connection dropped.
      setProblem(test
        ? "The test wasn't sent. Please check your connection and try again."
        : "We couldn't confirm it was sent. Check Registration's History before sending again.");
      setStatus("error");
      setConfirming(false);
    }
  }

  const n = offer.count;
  if (n > MESSAGE_MAX_PEOPLE) {
    return (
      <div className="pe-update" id="pe-update" data-pe-separate role="status">
        <p className="pe-update__text">
          You changed {changed}. The {people(n)} registered still {n === 1 ? "has" : "have"} it as it was. That&rsquo;s more than{" "}
          {MESSAGE_MAX_PEOPLE} can be emailed from here: send the update through the program&rsquo;s Flodesk segment.
        </p>
        <div className="pe-notice__actions">
          <button type="button" className="pe-btn" onClick={() => onDone(null)}>Close</button>
        </div>
      </div>
    );
  }
  const typedOver = (subject !== null || message !== null) && writtenAt !== null && offer.seq > writtenAt;
  return (
    <div className="pe-update" id="pe-update" data-pe-separate>
      <p className="pe-update__title">Tell the people registered?</p>
      <p className="pe-update__text">
        You changed {changed}. The {people(n)} registered still {n === 1 ? "has" : "have"} it as it was. Here&rsquo;s an update
        to send them; change it as you like.
      </p>
      <label className="pe-field">
        <span className="pe-field__label">Subject</span>
        <input
          className="pe-input"
          value={subj}
          maxLength={200}
          onChange={(e) => { setSubject(e.target.value); setWrittenAt(offer.seq); setConfirming(false); setStatus("idle"); }}
        />
      </label>
      <label className="pe-field">
        <span className="pe-field__label">Message</span>
        <span className="pe-field__help">It begins &ldquo;Hi&rdquo; and their first name, and ends with a link to the program. Replies come to the registrar&rsquo;s inbox.</span>
        <textarea
          className="pe-textarea"
          rows={8}
          value={msg}
          maxLength={10000}
          onChange={(e) => { setMessage(e.target.value); setWrittenAt(offer.seq); setConfirming(false); setStatus("idle"); }}
        />
      </label>
      {typedOver && (
        <p className="pe-field__help">
          You saved another change after writing this. Check it still says everything; your words are kept as you wrote them.
        </p>
      )}
      {confirming ? (
        <div className="pe-update__confirm" role="group" aria-label="Confirm">
          <p className="pe-update__text">Email this to {people(n)} now?</p>
          <div className="pe-notice__actions">
            <button type="button" className="pe-btn pe-btn--primary" disabled={status === "saving"} onClick={() => send(false)}>
              {status === "saving" ? "Sending…" : `Yes, send to ${people(n)}`}
            </button>
            <button type="button" className="pe-btn" disabled={status === "saving"} onClick={() => setConfirming(false)}>Not yet</button>
          </div>
        </div>
      ) : (
        <div className="pe-notice__actions">
          <button type="button" className="pe-btn pe-btn--primary" onClick={() => { setStatus("idle"); setConfirming(true); }}>
            Send to the {people(n)} registered
          </button>
          <button type="button" className="pe-btn" disabled={status === "saving"} onClick={() => send(true)}>
            {status === "saving" ? "Sending…" : "Send me a test"}
          </button>
          <button type="button" className="pe-btn pe-btn--ghost" onClick={() => onDone(null)}>Not now</button>
        </div>
      )}
      <SaveNote status={status} saved={answer} problem={problem} />
    </div>
  );
}

export default memo(UpdatePanel);
