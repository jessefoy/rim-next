"use client";

/**
 * TutorialSteps: a tutorial one step at a time (CSS prefix tut-). The words on
 * one side, a drawing of the screen on the other, with the place to tap
 * marked. "On a phone" and "On a computer" swap the drawings and the few
 * words that differ; the choice starts from the screen's width and is
 * remembered on this device. #step-N opens a step and follows the reader, so
 * a link can point at one step.
 *
 * Every drawing is rendered once on the server and stays in the page; only
 * which one shows changes. A drawing is drawn at the app's own size and
 * scaled to fit its frame here.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { TutorialDevice, TutorialStepText } from "@/components/tutorials/types";

const DEVICE_KEY = "rim-tutorial-device";
/** The size each drawing is made at, in CSS pixels (tut- canvas). */
const CANVAS: Record<TutorialDevice, { w: number; h: number }> = {
  phone: { w: 390, h: 820 },
  computer: { w: 1200, h: 740 },
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function stepFromHash(count: number): number | null {
  const m = /^#step-(\d+)$/.exec(window.location.hash);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= count ? n - 1 : null;
}

export default function TutorialSteps({
  steps,
  screens,
}: {
  steps: Record<TutorialDevice, TutorialStepText[]>;
  screens: Record<TutorialDevice, ReactNode[]>;
}) {
  const count = steps.phone.length;
  const [index, setIndex] = useState(0);
  const [device, setDevice] = useState<TutorialDevice>("computer");
  const [scale, setScale] = useState(0.4);
  const [ready, setReady] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Start where the link points, on the reader's kind of screen.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(DEVICE_KEY); } catch {}
    if (saved === "phone" || saved === "computer") setDevice(saved);
    else if (window.matchMedia("(max-width: 768px)").matches) setDevice("phone");
    const fromHash = stepFromHash(count);
    if (fromHash !== null) setIndex(fromHash);
    setReady(true);
    const onHash = () => {
      const n = stepFromHash(count);
      if (n !== null) setIndex(n);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [count]);

  // Fit the drawing to its frame.
  useIsoLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / CANVAS[device].w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  const go = useCallback(
    (n: number, focus = false) => {
      const next = Math.max(0, Math.min(count - 1, n));
      setIndex(next);
      try { window.history.replaceState(null, "", `#step-${next + 1}`); } catch {}
      if (focus) headingRef.current?.focus({ preventScroll: true });
    },
    [count],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Alt+Left is the browser's Back; leave it, and other shortcuts, alone.
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  function choose(d: TutorialDevice) {
    setDevice(d);
    try { window.localStorage.setItem(DEVICE_KEY, d); } catch {}
  }

  const step = steps[device][index];
  const canvas = CANVAS[device];

  return (
    <div className="tut">
      {/* A link to one step (#step-N) opens here, at the steps, by the
          browser's own scroll to an anchor. */}
      <div className="tut-anchors" aria-hidden="true">
        {steps.phone.map((_, i) => <span key={i} id={`step-${i + 1}`} />)}
      </div>
      <div className="tut-controls">
        <div className="tut-switch" role="group" aria-label="Show the screens">
          {(["phone", "computer"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => choose(d)}>
              {d === "phone" ? "On a phone" : "On a computer"}
            </button>
          ))}
        </div>
        <ol className="tut-steps" aria-label="Steps">
          {steps[device].map((s, i) => (
            <li key={i}>
              <a
                href={`#step-${i + 1}`}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                onClick={(e) => { e.preventDefault(); go(i, true); }}
              >
                {i + 1}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div className={`tut-stage tut-stage--${device}${ready ? "" : " tut-stage--pending"}`}>
        <div className="tut-words" aria-live="polite">
          <p className="tut-count">Step {index + 1} of {count}</p>
          <h2 className="tut-title" ref={headingRef} tabIndex={-1}>{step.title}</h2>
          <p>{step.words}</p>
          {step.tip && (
            <p className="tut-tip"><strong>{step.tip.lead}</strong> {step.tip.text}</p>
          )}
          {step.next && (
            <p><a href={step.next.href} className="tut-onward">{step.next.label}</a></p>
          )}
          <div className="tut-nav">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => go(index - 1, true)} disabled={index === 0}>
              Back
            </button>
            {index === count - 1 ? (
              <a href="/tutorials" className="pp-btn">All tutorials</a>
            ) : (
              <button type="button" className="pp-btn" onClick={() => go(index + 1, true)}>
                Next
              </button>
            )}
          </div>
        </div>

        <div className={`tut-device tut-device--${device}`}>
          <div
            ref={viewportRef}
            className="tut-viewport"
            role="img"
            aria-label={step.alt}
            style={{ height: Math.round(canvas.h * scale) }}
          >
            <div
              className="tut-canvas"
              style={{ width: canvas.w, height: canvas.h, transform: `scale(${scale})` }}
              aria-hidden="true"
            >
              {screens[device].map((node, i) => (
                <div key={i} className={`tut-shot${i === index ? " tut-shot--on" : ""}`}>
                  {node}
                </div>
              ))}
            </div>
            <span className="tut-example" aria-hidden="true">Example</span>
          </div>
        </div>
      </div>
    </div>
  );
}
