"use client";

/**
 * Post a notice (2026-10-24, Phase 2): a change people should know
 * ("Cancelled tonight", "We're in the community room"), posted from the top
 * of the program editor through POST /api/programs-pg/[slug]/notice, apart
 * from the editor's Save. It shows wherever the program is listed and on My
 * Home until its last day. Those who can open Registration may also email
 * everyone with a place. Its fields carry data-pe-separate, so typing here
 * never marks the program unsaved.
 */

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveNote } from "@/components/FormDone";

interface Props {
  slug: string;
  initialNotice: string;
  /** "YYYY-MM-DD" (a Central day) or "". */
  initialUntil: string;
  /** May email the people registered (canUseRegistration). */
  canEmail: boolean;
  /** People with a place, for "Also email the N people registered"; null when not shown. */
  registeredCount: number | null;
}

const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

function NoticePanel({ slug, initialNotice, initialUntil, canEmail, registeredCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // What is posted now, and what is being written.
  const [posted, setPosted] = useState({ notice: initialNotice, until: initialUntil });
  const [notice, setNotice] = useState(initialNotice);
  const [until, setUntil] = useState(initialUntil);
  const [emailToo, setEmailToo] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [problem, setProblem] = useState("");
  const [answer, setAnswer] = useState("");

  const people = registeredCount ?? 0;
  const showEmail = canEmail && people > 0;

  async function send(takeDown: boolean) {
    const text = takeDown ? "" : notice.trim();
    if (!takeDown && !text) {
      setProblem("Write the notice first: one line, like “Cancelled tonight.”");
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/programs-pg/${slug}/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: text, until: takeDown ? null : until || null, email: !takeDown && showEmail && emailToo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(json.error || "The notice wasn't posted. Please try again.");
        setStatus("error");
        return;
      }
      setPosted({ notice: text, until: takeDown ? "" : until });
      if (takeDown) {
        setNotice("");
        setUntil("");
        setAnswer("The notice is taken down.");
      } else {
        const where = "It shows on the program’s page, Programs & Events, This Week and My Home";
        const when = until ? ` through ${fmtDay(until)}.` : " until you take it down.";
        const sent = json.count > 0 ? ` It’s being emailed to ${json.count === 1 ? "1 person" : `${json.count} people`} now.` : "";
        setAnswer(`Posted. ${where}${when}${sent}`);
      }
      setEmailToo(false);
      setStatus("saved");
      router.refresh();
    } catch {
      setProblem("The notice wasn't posted. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="pe-notice" data-pe-separate>
      <div className="pe-notice__bar">
        <button
          type="button"
          className="pe-btn"
          aria-expanded={open}
          aria-controls="pe-notice-panel"
          onClick={() => { setOpen((o) => !o); setStatus("idle"); }}
        >
          {posted.notice ? "Change the notice" : "Post a notice"}
        </button>
        {posted.notice && !open && (
          <p className="pe-notice__now">
            <span className="pe-notice__label">Notice up now:</span> {posted.notice}
            {posted.until ? ` (through ${fmtDay(posted.until)})` : ""}
          </p>
        )}
      </div>

      {open && (
        <div className="pe-notice__panel" id="pe-notice-panel">
          <p className="pe-field__help">
            A change people should know: &ldquo;Cancelled tonight.&rdquo; &ldquo;Starting at 7:15.&rdquo;
            &ldquo;We&rsquo;re in the community room.&rdquo; It shows on the program&rsquo;s page, Programs
            &amp; Events, This Week and My Home.
          </p>
          <label className="pe-field">
            <span className="pe-field__label">Notice</span>
            <textarea
              className="pe-textarea"
              rows={2}
              value={notice}
              onChange={(e) => { setNotice(e.target.value); if (status !== "saving") setStatus("idle"); }}
            />
          </label>
          <label className="pe-field">
            <span className="pe-field__label">Show until</span>
            <span className="pe-field__help">The last day it shows; it clears itself the next morning. Leave empty to keep it until you take it down.</span>
            <input
              type="date"
              className="pe-input pe-input--narrow"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          {showEmail && (
            <label className="pe-checkbox">
              <input type="checkbox" checked={emailToo} onChange={(e) => setEmailToo(e.target.checked)} />
              <span>Also email the {people === 1 ? "1 person" : `${people} people`} registered</span>
            </label>
          )}
          <div className="pe-notice__actions">
            <button type="button" className="pe-btn pe-btn--primary" disabled={status === "saving"} onClick={() => send(false)}>
              {status === "saving" ? "Posting…" : "Post the notice"}
            </button>
            {posted.notice && (
              <button type="button" className="pe-btn" disabled={status === "saving"} onClick={() => send(true)}>
                Take the notice down
              </button>
            )}
            <button type="button" className="pe-btn pe-btn--ghost" disabled={status === "saving"} onClick={() => { setOpen(false); setNotice(posted.notice); setUntil(posted.until); setStatus("idle"); }}>
              Close
            </button>
          </div>
          <SaveNote status={status} saved={answer} problem={problem} />
        </div>
      )}
    </div>
  );
}

export default memo(NoticePanel);
