"use client";

/**
 * A program's registration settings in the Registration app (2026-10-23):
 * open, not open yet (with its opening date) or closed, places, the closing
 * date, the mailing list and its Flodesk
 * segment. Folded under Needs you; its summary line says where things stand.
 * Saves through PATCH /api/programs/[slug]/registration-settings, which refuses
 * fewer places than are taken and a save over a change made since the page
 * loaded. Turning registration on or off stays in the program editor; the
 * mailing list lives only here (2026-10-24). CSS: reg-.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SaveNote } from "@/components/FormDone";
import { toCentralDatetime } from "@/lib/timezone";

export interface SettingsValues {
  closed: boolean;
  /** Empty for no limit. */
  places: string;
  /** "YYYY-MM-DDTHH:mm" in Central time, or empty. */
  closes: string;
  /** When registration opens, "YYYY-MM-DDTHH:mm" in Central time, or empty. */
  opens: string;
  /** null: the default rule. */
  mailingList: boolean | null;
  /** The linked Flodesk segment, or null until the first registration makes one. */
  segmentId: string | null;
}

export default function RegistrationSettings({
  programSlug,
  updatedAt,
  initial,
  summary,
  taken,
  waiting,
  mailingListByDefault,
  segmentName,
  newSegmentName,
}: {
  programSlug: string;
  updatedAt: string;
  initial: SettingsValues;
  /** "Open · 14 places · closes Nov 6, 2026 · mailing list on" */
  summary: string;
  /** Places taken now (registered, and held while paying). */
  taken: number;
  waiting: number;
  /** What "Automatic" means for this program today. */
  mailingListByDefault: boolean;
  segmentName: string | null;
  /** The name a new segment takes at the first registration ("Name MM/DD/YY"). */
  newSegmentName: string;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [values, setValues] = useState<SettingsValues>(initial);
  const [loadedAt, setLoadedAt] = useState(updatedAt);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [problem, setProblem] = useState("");
  // Flodesk's segments, loaded only when someone asks to choose one.
  const [segments, setSegments] = useState<{ id: string; name: string }[] | null>(null);
  const [segmentsProblem, setSegmentsProblem] = useState("");
  const [loadingSegments, setLoadingSegments] = useState(false);

  async function loadSegments() {
    setSegmentsProblem("");
    setLoadingSegments(true);
    try {
      const res = await fetch("/api/flodesk/segments");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Flodesk didn't answer. Try again in a moment.");
      setSegments(data.segments);
    } catch (err) {
      setSegmentsProblem(err instanceof Error ? err.message : "Flodesk didn't answer. Try again in a moment.");
    } finally {
      setLoadingSegments(false);
    }
  }

  // Open, not open yet, or closed: "not open yet" is an opening date still
  // ahead (lib/registrationWindow.ts). Chosen here, it stays chosen until a
  // date is set, and Save asks for one still ahead.
  const [notYetPicked, setNotYetPicked] = useState(false);
  const nowCt = toCentralDatetime(new Date());
  const state: "open" | "notYet" | "closed" = values.closed
    ? "closed"
    : notYetPicked || (values.opens && values.opens > nowCt)
      ? "notYet"
      : "open";
  function chooseState(next: "open" | "notYet" | "closed") {
    setNotYetPicked(next === "notYet");
    change(next === "closed" ? { closed: true } : next === "open" ? { closed: false, opens: "" } : { closed: false });
  }

  function change(next: Partial<SettingsValues>) {
    setValues((v) => ({ ...v, ...next }));
    if (status !== "saving") setStatus("idle");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const places = values.places.trim();
    if (places && (!/^\d+$/.test(places) || Number(places) < 1)) {
      setProblem("Places must be a whole number of at least 1, or empty for no limit.");
      setStatus("error");
      return;
    }
    if (state === "notYet" && !(values.opens && values.opens > nowCt)) {
      setProblem("Choose when registration opens, a date and time still ahead. Or choose Open.");
      setStatus("error");
      return;
    }
    if (state !== "closed" && values.opens && values.closes && values.closes <= values.opens) {
      setProblem("The closing date comes before registration opens. Move one of them.");
      setStatus("error");
      return;
    }
    if (places && Number(places) < taken) {
      setProblem(`${taken} ${taken === 1 ? "place is" : "places are"} already taken, so places can't be fewer than ${taken}.`);
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/programs/${programSlug}/registration-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updatedAt: loadedAt,
          registrationClosed: values.closed,
          registrationCapacity: places ? Number(places) : null,
          registrationDeadline: values.closes || null,
          registrationOpensAt: values.opens || null,
          flodeskSync: values.mailingList,
          // Sent only when chosen here, so a save can never undo a segment
          // that a first registration made while this page was open.
          // Only while the mailing list is on: a choice the panel no longer
          // shows is never saved.
          ...(mailingListOn && values.segmentId !== initial.segmentId ? { flodeskSegmentId: values.segmentId } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(json.error || "The settings weren't saved. Please try again.");
        setStatus("error");
        return;
      }
      if (json.updatedAt) setLoadedAt(json.updatedAt);
      setStatus("saved");
      startRefresh(() => router.refresh());
    } catch {
      setProblem("The settings weren't saved. Please try again.");
      setStatus("error");
    }
  }

  const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
  const mailingListOn = values.mailingList ?? mailingListByDefault;
  // The segment as chosen now: one picked from the list, or the linked one.
  const chosenName =
    values.segmentId === initial.segmentId
      ? segmentName
      : segments?.find((s) => s.id === values.segmentId)?.name ?? null;

  return (
    <details className="reg-fold reg-settings">
      <summary>
        Registration settings <span className="reg-settings__sum">{summary}</span>
      </summary>
      <form className="reg-panel" onSubmit={save} noValidate>
        <div className="reg-fields">
          <label className="reg-field">
            <span>Registration</span>
            <select value={state} onChange={(e) => chooseState(e.target.value as "open" | "notYet" | "closed")}>
              <option value="open">Open</option>
              <option value="notYet">Not open yet</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          {state === "notYet" && (
            <label className="reg-field">
              <span>Opens</span>
              <input type="datetime-local" value={values.opens} onChange={(e) => change({ opens: e.target.value })} />
            </label>
          )}
          <label className="reg-field">
            <span>Places</span>
            <input
              type="number"
              inputMode="numeric"
              min={Math.max(1, taken)}
              value={values.places}
              placeholder="No limit"
              onChange={(e) => change({ places: e.target.value })}
            />
          </label>
          <label className="reg-field">
            <span>Closes</span>
            <input type="datetime-local" value={values.closes} onChange={(e) => change({ closes: e.target.value })} />
          </label>
          <label className="reg-field">
            <span>Mailing list</span>
            <select
              value={values.mailingList === null ? "auto" : values.mailingList ? "on" : "off"}
              onChange={(e) => change({ mailingList: e.target.value === "auto" ? null : e.target.value === "on" })}
            >
              <option value="auto">Automatic ({mailingListByDefault ? "on" : "off"})</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
        {mailingListOn && (
          segments === null ? (
            <div className="reg-actions">
              <button type="button" className="vol-action-btn" onClick={loadSegments} disabled={loadingSegments}>
                {loadingSegments
                  ? "Asking Flodesk…"
                  : initial.segmentId ? "Choose a different segment" : "Use an existing segment instead"}
              </button>
            </div>
          ) : (
            <div className="reg-fields reg-fields--one">
              <label className="reg-field">
                <span>Flodesk segment</span>
                <select
                  value={values.segmentId ?? ""}
                  onChange={(e) => change({ segmentId: e.target.value || null })}
                >
                  {/* A new segment only while none is linked: Flodesk can't
                      rename or delete one, so a second would duplicate it. */}
                  {!initial.segmentId && (
                    <option value="">Make a new segment at the first registration</option>
                  )}
                  {initial.segmentId && !segments.some((s) => s.id === initial.segmentId) && (
                    <option value={initial.segmentId}>{segmentName || "The linked segment"}</option>
                  )}
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )
        )}
        {segmentsProblem && <p className="save-note save-note--error" role="alert">{segmentsProblem}</p>}
        <ul className="reg-settings__notes">
          {values.closed && (
            <li>
              Closed stops new sign-ups.{" "}
              {waiting > 0
                ? `The ${people(waiting)} waiting stay on the waiting list, and you can still offer them places.`
                : "Everyone registered keeps their place."}
            </li>
          )}
          <li>
            {taken > 0
              ? `${taken} ${taken === 1 ? "place is" : "places are"} taken, so places can't be fewer than ${taken}. Leave it empty for no limit.`
              : "Leave places empty for no limit."}
          </li>
          {!values.closed && values.closes && new Date(`${values.closes}:00-06:00`) < new Date() && (
            <li>That closing date has passed, so registration stays closed until you move the date or clear it.</li>
          )}
          {state === "notYet" && (
            <li>Until it opens, the program page says when, with no sign-up button. Who can join the sessions doesn&rsquo;t change.</li>
          )}
          <li>Opens and Closes are Central time; leave Closes empty to stay open until you close it.</li>
          <li>
            {!mailingListOn
              ? "With the mailing list off, no one is added to Flodesk."
              : chosenName
                ? `With the mailing list on, each person who registers from then on joins the Flodesk segment "${chosenName}", for newsletters only.`
                : `With the mailing list on, each person who registers from then on joins a new Flodesk segment named "${newSegmentName}", made at the first registration, for newsletters only.`}{" "}
            Use an existing segment for a program that already has one, so its people stay together.
          </li>
        </ul>
        <div className="reg-actions">
          <button type="submit" className="vol-save-btn" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save settings"}
          </button>
        </div>
        <SaveNote status={status} saved="Saved. The program is updated." problem={problem} />
      </form>
    </details>
  );
}
