"use client";

/**
 * The people with a place at one session, each with an Arrived button, for a
 * supporting team's session page (2026-10-24, Phase 3 slice 4). A tap marks
 * them here (POST /api/programs/[slug]/attendance); a second tap takes it
 * back. The count above the list follows. Names and the team's own questions
 * only: never contact details, never dana. CSS: hlp-.
 */

import { useState } from "react";

export interface ArrivalPerson {
  id: string;
  name: string;
  /** Their answers to this team's questions. */
  answers: { label: string; value: string }[];
  arrived: boolean;
}

export default function ArrivalList({
  programSlug,
  day,
  team,
  people,
}: {
  programSlug: string;
  day: string;
  team: string;
  people: ArrivalPerson[];
}) {
  const [here, setHere] = useState<Set<string>>(() => new Set(people.filter((p) => p.arrived).map((p) => p.id)));
  // Per person, so taps on two rows at once don't clear each other.
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [problems, setProblems] = useState<Record<string, string>>({});
  const mark = <T,>(set: Set<T>, v: T, on: boolean) => {
    const s = new Set(set);
    if (on) s.add(v);
    else s.delete(v);
    return s;
  };

  async function toggle(p: ArrivalPerson) {
    const next = !here.has(p.id);
    setBusy((prev) => mark(prev, p.id, true));
    setProblems(({ [p.id]: _gone, ...rest }) => { void _gone; return rest; });
    try {
      const res = await fetch(`/api/programs/${programSlug}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: p.id, day, team, arrived: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "");
      setHere((prev) => mark(prev, p.id, next));
    } catch (err) {
      const text = err instanceof Error && err.message ? err.message : "That didn’t save. Please try again.";
      setProblems((prev) => ({ ...prev, [p.id]: text }));
    } finally {
      setBusy((prev) => mark(prev, p.id, false));
    }
  }

  return (
    <>
      <p className="hlp-state" role="status">
        {people.length} {people.length === 1 ? "person is" : "people are"} registered &middot; {here.size} here
      </p>
      <ul className="hlp-door">
        {people.map((p) => {
          const isHere = here.has(p.id);
          return (
            <li key={p.id} className={`hlp-door__row${isHere ? " hlp-door__row--here" : ""}`}>
              <div className="hlp-door__who">
                <span className="hlp-door__name">{p.name}</span>
                {p.answers.map((a) => (
                  <span key={a.label} className="hlp-door__answer">{a.label}: {a.value}</span>
                ))}
                {problems[p.id] && <span className="hlp-door__problem" role="alert">{problems[p.id]}</span>}
              </div>
              <button
                type="button"
                className={`hlp-door__btn${isHere ? " hlp-door__btn--here" : ""}`}
                aria-pressed={isHere}
                disabled={busy.has(p.id)}
                onClick={() => toggle(p)}
              >
                {busy.has(p.id) ? "Saving…" : isHere ? "Here ✓" : "Arrived"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
