"use client";

/**
 * TutorialPlayer: a tutorial played like a video (2026-10-22, Jesse: "make
 * those tutorials into a video animation… do a second page so that we don't
 * replace this one"; captions only, no voice). One Play button; then each
 * step shows its screen, its words as a caption, and a finger that moves to
 * the marked place and taps it before the next screen comes in. Pause, Back,
 * Next and Watch again are always there. Same drawings and words as the
 * step-by-step page (components/TutorialSteps.tsx), so the two can't drift.
 * CSS prefix tut-.
 *
 * Each step lasts long enough to read its caption at an easy pace (two and a
 * half words a second, never under seven seconds); the finger moves within
 * its first few seconds, so the action shows while people read. Pausing holds
 * the step; playing again
 * starts that step over. With reduced motion asked for, the finger appears in
 * place instead of travelling. The Play cover and the end screen sit beside
 * the drawing (role="img"), not inside it, so they stay real buttons.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { TutorialDevice, TutorialStepText } from "@/components/tutorials/types";

const DEVICE_KEY = "rim-tutorial-device";
const CANVAS: Record<TutorialDevice, { w: number; h: number }> = {
  phone: { w: 390, h: 820 },
  computer: { w: 1200, h: 740 },
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** How long a step stays, in ms: time to read its caption slowly. */
function stepDuration(step: TutorialStepText): number {
  const text = `${step.title} ${step.words} ${step.tip ? `${step.tip.lead} ${step.tip.text}` : ""}`;
  const words = text.trim().split(/\s+/).length;
  return Math.max(7000, Math.round((words / 2.5) * 1000) + 2000);
}

type Phase = "show" | "move" | "tap";

export default function TutorialPlayer({
  steps,
  screens,
  finish,
  stepByStepHref,
}: {
  steps: Record<TutorialDevice, TutorialStepText[]>;
  screens: Record<TutorialDevice, ReactNode[]>;
  /** Where the end leads: the next tutorial, or back to all of them. */
  finish: { href: string; label: string };
  stepByStepHref: string;
}) {
  const count = steps.phone.length;
  const [device, setDevice] = useState<TutorialDevice>("computer");
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [phase, setPhase] = useState<Phase>("show");
  const [run, setRun] = useState(0); // bumps to restart the current step
  const [scale, setScale] = useState(0.4);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);

  // The reader's kind of screen, before anything shows (no flash of the other).
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(DEVICE_KEY); } catch {}
    if (saved === "phone" || saved === "computer") setDevice(saved);
    else if (window.matchMedia("(max-width: 768px)").matches) setDevice("phone");
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setReady(true);
  }, []);

  useIsoLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / CANVAS[device].w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  // Where the marked place is on screen, for the finger.
  const findTarget = useCallback(() => {
    const vp = viewportRef.current;
    const mark = vp?.querySelector(".tut-shot--on .hl");
    if (!vp || !mark) return null;
    const a = vp.getBoundingClientRect();
    const b = mark.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
  }, []);

  // One step's timeline: the screen and caption, then the finger moves, then taps.
  useEffect(() => {
    if (!playing) return;
    const step = steps[device][index];
    const total = stepDuration(step);
    // The finger moves soon, then taps; the rest of the step is for reading.
    const moveAt = Math.min(6000, Math.max(2500, Math.round(total * 0.3)));
    const tapAt = moveAt + 1600;
    let slide = 0;
    setPhase("show");
    setFinger(null);
    const timers = [
      window.setTimeout(() => {
        const t = findTarget();
        setPhase("move");
        if (!t) return;
        if (reduced) { setFinger(t); return; }
        // In from just below and right of the place, so the eye follows it
        // there. A timer, not an animation frame: frames wait in a tab out of view.
        setFinger({ x: t.x + 70, y: t.y + 110 });
        slide = window.setTimeout(() => setFinger(t), 50);
      }, moveAt),
      window.setTimeout(() => setPhase("tap"), tapAt),
      window.setTimeout(() => {
        if (index < count - 1) setIndex(index + 1);
        else { setPlaying(false); setEnded(true); }
      }, total),
    ];
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(slide);
    };
  }, [playing, index, device, run, steps, count, findTarget, reduced]);

  // Paused, the finger rests on the step's mark, so the picture still says where.
  useEffect(() => {
    if (!playing && started && !ended) {
      const t = findTarget();
      if (t) setFinger(t);
    }
  }, [playing, started, ended, index, device, scale, findTarget]);

  // A turned phone or a resized window keeps the finger on its mark.
  useEffect(() => {
    if (!playing) return;
    setFinger((f) => (f ? findTarget() ?? f : f));
  }, [scale, playing, findTarget]);

  function play() {
    const fromOverlay = !started || ended;
    if (ended) { setIndex(0); setEnded(false); }
    setStarted(true);
    setPlaying(true);
    setRun((r) => r + 1);
    // The cover or end screen goes away; keep the keyboard on Pause.
    if (fromOverlay) window.setTimeout(() => controlRef.current?.focus(), 0);
  }
  function pause() {
    setPlaying(false);
    setPhase("show");
  }
  function go(n: number) {
    setEnded(false);
    setStarted(true);
    setPhase("show");
    setIndex(Math.max(0, Math.min(count - 1, n)));
    setRun((r) => r + 1);
  }
  function choose(d: TutorialDevice) {
    setDevice(d);
    setFinger(null);
    setRun((r) => r + 1);
    try { window.localStorage.setItem(DEVICE_KEY, d); } catch {}
  }

  const step = steps[device][index];
  const canvas = CANVAS[device];

  return (
    <div className="tut tut-player">
      <div className="tut-switch" role="group" aria-label="Show the screens">
        {(["phone", "computer"] as const).map((d) => (
          <button key={d} type="button" aria-pressed={device === d} onClick={() => choose(d)}>
            {d === "phone" ? "On a phone" : "On a computer"}
          </button>
        ))}
      </div>

      <div className={`tut-player__stage tut-player__stage--${device}${ready ? "" : " tut-stage--pending"}`}>
        <div className={`tut-device tut-device--${device}`}>
          <div className="tut-player__screen">
            <div
              ref={viewportRef}
              className="tut-viewport"
              role="img"
              aria-label={step.alt}
              data-phase={playing ? phase : "still"}
              style={{ height: Math.round(canvas.h * scale) }}
            >
              <div className="tut-canvas" style={{ width: canvas.w, height: canvas.h, transform: `scale(${scale})` }} aria-hidden="true">
                {screens[device].map((node, i) => (
                  <div key={i} className={`tut-shot${i === index ? " tut-shot--on" : ""}`}>{node}</div>
                ))}
              </div>
              {finger && (
                <span
                  className={`tut-finger${playing && phase === "tap" ? " tut-finger--tap" : ""}${reduced ? " tut-finger--still" : ""}`}
                  style={{ left: finger.x, top: finger.y }}
                  aria-hidden="true"
                />
              )}
            </div>
            {!started && (
              <button type="button" className="tut-player__cover" onClick={play}>
                <span className="tut-player__big" aria-hidden="true">{"▶︎"}</span>
                <span className="tut-player__cover-label">Play</span>
              </button>
            )}
            {ended && (
              <div className="tut-player__end">
                <p className="tut-player__end-title">That&rsquo;s all for this one.</p>
                <a href={finish.href} className="pp-btn">{finish.label}</a>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={play}>Watch again</button>
              </div>
            )}
          </div>
        </div>

        <div className="tut-player__caption" aria-live="polite">
          <p className="tut-count">Step {index + 1} of {count}</p>
          <p className="tut-player__title">{step.title}</p>
          <p className="tut-player__words">{step.words}</p>
          {step.tip && <p className="tut-player__tip"><strong>{step.tip.lead}</strong> {step.tip.text}</p>}
        </div>
      </div>

      <div className="tut-player__progress" aria-hidden="true">
        {steps[device].map((_, i) => (
          <span key={i} className={i < index || ended ? "done" : i === index ? "now" : ""} />
        ))}
      </div>

      <div className="tut-player__controls">
        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
        <button type="button" className="pp-btn" ref={controlRef} onClick={playing ? pause : play}>
          {playing ? "Pause" : ended ? "Watch again" : "Play"}
        </button>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => go(index + 1)} disabled={index === count - 1}>Next</button>
      </div>
      <p className="tut-player__alt"><a href={stepByStepHref}>Prefer to go at your own pace? The step-by-step version →</a></p>
    </div>
  );
}
