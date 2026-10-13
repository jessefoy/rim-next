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

/**
 * Brings an answer to the person: when `key` changes while `active`, the
 * element scrolls into view and takes focus (give it tabIndex={-1}). For a
 * form whose own success block replaces it (RegistrationForm), pass the
 * result phase as the key and active only once the person has submitted.
 */
export function useArrival<T extends HTMLElement>(key: unknown = null, active = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After the frame, so it wins over any scroll the page itself does.
    const id = requestAnimationFrame(() => {
      // Scroll only when its top isn't comfortably in view (hidden under the
      // header, above the screen, or low on it); the page's scroll-padding
      // keeps the header from covering it.
      const top = el.getBoundingClientRect().top;
      if (top < 96 || top > window.innerHeight * 0.6) {
        el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [key, active]);
  return ref;
}

export default function FormDone({
  title,
  children,
  clearParam,
}: {
  title: string;
  children?: ReactNode;
  /** A query parameter that brought this answer (My Home's ?welcome): removed
      from the address once shown, so a reload or Back doesn't repeat it. */
  clearParam?: string;
}) {
  const ref = useArrival<HTMLDivElement>();
  const titleId = useId();
  useEffect(() => {
    if (!clearParam) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(clearParam)) return;
    url.searchParams.delete(clearParam);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [clearParam]);

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
  // The status region is always present (so screen readers are listening
  // before the answer comes); a problem is a separate alert, newly inserted,
  // which is what reliably gets announced.
  return (
    <>
      <p className={`save-note${status === "saved" ? " save-note--saved" : ""}`} role="status">
        {status === "saved" ? saved : ""}
      </p>
      {status === "error" && (
        <p className="save-note save-note--error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
