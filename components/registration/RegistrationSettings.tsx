"use client";

/**
 * A program's registration settings in the Registration app (2026-10-23):
 * open or closed, places, the closing date, the mailing list. Folded under
 * Needs you; its summary line says where things stand. Saves through
 * PATCH /api/programs/[slug]/registration-settings, which refuses fewer
 * places than are taken and a save over a change made since the page loaded.
 * Turning registration on or off, and the mailing-list segment, stay in the
 * program editor. CSS: reg-.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SaveNote } from "@/components/FormDone";

export interface SettingsValues {
  closed: boolean;
  /** Empty for no limit. */
  places: string;
  /** "YYYY-MM-DDTHH:mm" in Central time, or empty. */
  closes: string;
  /** null: the default rule. */
  mailingList: boolean | null;
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
  editHref,
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
  editHref: string | null;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [values, setValues] = useState<SettingsValues>(initial);
  const [loadedAt, setLoadedAt] = useState(updatedAt);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [problem, setProblem] = useState("");

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
          flodeskSync: values.mailingList,
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

  return (
    <details className="reg-fold reg-settings">
      <summary>
        Registration settings <span className="reg-settings__sum">{summary}</span>
      </summary>
      <form className="reg-panel" onSubmit={save} noValidate>
        <div className="reg-fields">
          <label className="reg-field">
            <span>Registration</span>
            <select value={values.closed ? "closed" : "open"} onChange={(e) => change({ closed: e.target.value === "closed" })}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
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
          <li>Closes is Central time; leave it empty to stay open until you close it.</li>
          <li>
            With the mailing list on, each person who registers from then on joins the program&rsquo;s Flodesk segment
            {segmentName ? ` "${segmentName}"` : ""}, for newsletters only.
            {editHref && (
              <>
                {" "}The segment itself is chosen in{" "}
                <a href={editHref} className="reg-link">the program editor</a>.
              </>
            )}
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
