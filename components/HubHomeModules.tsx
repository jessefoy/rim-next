"use client";

/** Shared schedule and editing modules for the universal Space Home. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div className="hub-home__editor-loading">Loading editor…</div> },
);

export interface ThisMonthGlance {
  monthLabel: string;
  coverageNoun: string;
  totalSessions: number;
  openSessions: number;
  hostingMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
  availableMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
}

/* ─────────────────  Our offerings this month panel  ─────────────────────────
   Shown to everyone. Sangha-friendly framing: work is collective, members
   not yet on the schedule are described as "available" — not absent. */

export function ThisMonthGlancePanel({ data, hubSlug }: { data: ThisMonthGlance; hubSlug: string }) {
  if (data.totalSessions === 0 && data.hostingMembers.length === 0 && data.availableMembers.length === 0) {
    return null;
  }

  const hostingCount = data.hostingMembers.length;
  const sessionsLabel = data.totalSessions === 1 ? "session" : "sessions";
  const role = data.coverageNoun.toLowerCase();
  const rolesLabel = hostingCount === 1 ? role : `${role}s`;

  return (
    <section className="hh-month">
      <div className="hh-month__heading">Our offerings this month</div>

      <p className="hh-month__summary">
        <strong>{data.totalSessions}</strong>{" "}
        {data.totalSessions === 1 ? "session" : "sessions"} in {data.monthLabel} ·{" "}
        <strong>{hostingCount}</strong> {rolesLabel} contributing
        {data.openSessions > 0 && (
          <>
            {" "}· <strong>{data.openSessions}</strong> still {data.openSessions === 1 ? "needs" : "need"} {role === "av" ? "AV" : `a ${role}`}
          </>
        )}
        .
      </p>

      {data.hostingMembers.length > 0 && (
        <div className="hh-month__group">
          <div className="hh-month__group-label">{data.coverageNoun === "Host" ? "Hosting" : `${data.coverageNoun} coverage`}</div>
          <ul className="hh-month__pills">
            {data.hostingMembers.map((m) => (
              <li
                key={m.userId}
                className={`hh-month__pill${m.isCoordinator ? " hh-month__pill--coord" : ""}`}
              >
                <span className="hh-month__pill-name">{m.name}</span>
                <span
                  className="hh-month__pill-count"
                  aria-label={`${m.count} ${m.count === 1 ? sessionsLabel : "sessions"}`}
                >
                  {m.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.availableMembers.length > 0 && (
        <div className="hh-month__group">
          <div className="hh-month__group-label">Available, not yet on the schedule</div>
          <ul className="hh-month__pills hh-month__pills--quiet">
            {data.availableMembers.map((m) => (
              <li
                key={m.userId}
                className={`hh-month__pill hh-month__pill--quiet${m.isCoordinator ? " hh-month__pill--coord" : ""}`}
              >
                <span className="hh-month__pill-name">{m.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.openSessions > 0 && (
        <Link
          href={
            hubSlug === "host-team"
              ? "/tools/schedule"
              : `/tools/schedule?hub=${encodeURIComponent(hubSlug)}`
          }
          className="hh-month__cta"
        >
          See the schedule →
        </Link>
      )}
    </section>
  );
}

export function InlineBlockEditor({
  slug,
  field,
  initialValue,
  placeholder,
  onDone,
}: {
  slug: string;
  field: "welcomeBody" | "homeContent";
  initialValue: string;
  placeholder: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/hubs/${slug}/home`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      onDone();
      router.refresh();
    } catch {
      setError("That change couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hub-home__editor">
      <RimTiptapEditor
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        variant="message"
      />
      {error && <div className="hub-home__editor-error" role="alert">{error}</div>}
      <div className="hub-home__editor-actions">
        <button
          type="button"
          className="hub-home__editor-cancel"
          onClick={onDone}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="hub-home__editor-save"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
