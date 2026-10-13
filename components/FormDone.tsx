"use client";

/**
 * A form's confirmation, brought to where the person is (Jesse, 2026-10-13):
 * "it wasn't clear that it was filled out or submitted... we're designing for
 * non-tech-savvy folks. This rule should apply across the board."
 *
 * When it appears it scrolls itself into view and takes focus, so it is seen
 * (and announced) even when the form was long and the page had scrolled.
 * The title says plainly what happened; the body says what comes next. Use it
 * for every public and member form's success state. CSS: .pp-form__done.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";

export default function FormDone({ title, children }: { title: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After the frame, so it wins over any scroll the navigation itself does.
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div ref={ref} className="pp-form__done" role="status" tabIndex={-1} aria-labelledby={titleId}>
      <p className="pp-form__done-title" id={titleId}>{title}</p>
      {children}
    </div>
  );
}

/**
 * A form's problem, said beside the button the person just pressed (not at the
 * top of a long form, where it can be off-screen). What they wrote stays.
 */
export function FormProblem({ status }: { status: string }) {
  if (status === "error") {
    return (
      <p className="pp-form__error" role="alert">
        Something went wrong, and this was not sent. What you wrote is still here. Please try again.
      </p>
    );
  }
  if (status === "email") {
    return (
      <p className="pp-form__error" role="alert">
        That email address doesn&rsquo;t look right. Please check it and try again.
      </p>
    );
  }
  if (status === "signin") {
    return (
      <p className="pp-form__error" role="alert">
        You&rsquo;ve been signed out, so this was not sent. What you wrote is still here.{" "}
        <a href="/login" target="_blank" rel="noopener">Sign in again in a new tab</a>, then
        come back and press the button again.
      </p>
    );
  }
  return null;
}

/**
 * The answer to a save that keeps the person on the same screen (a profile,
 * a note): said beside the button, and kept until they change something
 * again, never a flash that vanishes. role=status for "saved", role=alert for
 * a problem. The caller sets status back to "idle" on the next edit.
 */
export function SaveNote({
  status,
  saved,
  problem,
}: {
  status: "idle" | "saving" | "saved" | "error";
  saved: string;
  problem: string;
}) {
  if (status === "saved") {
    return (
      <p className="save-note save-note--saved" role="status">
        {saved}
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="save-note save-note--error" role="alert">
        {problem}
      </p>
    );
  }
  // Present but empty, so screen readers are listening before the answer comes.
  return <p className="save-note" role="status" aria-live="polite" />;
}
