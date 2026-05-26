"use client";

/**
 * HostHubHomeClient — single unified Hub Home for the Host Hub.
 *
 * Shape (top to bottom):
 *   1. Header (greeting + hub name)
 *   2. Welcome message — coordinator-editable, read-only for everyone else
 *   3. "Our offerings this month" panel
 *
 * Everything else (pinned threads, team roster, troubleshooting, quick links,
 * tasks) was removed in favor of the navigation links in the sidebar.
 *
 * CSS prefix: hub-home- (shared chrome) + hh-month (panel).
 */

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
  totalSessions: number;
  openSessions: number;
  hostingMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
  availableMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
}

interface Props {
  slug: string;
  hubName: string;
  canEditContent: boolean;
  welcomeHtml: string;
  welcomeBody: string;
  thisMonth: ThisMonthGlance;
  /** Slug of this hub's orientation manual chapter. For host-team this is
   *  "host-hub" (legacy chapter name); for every other hosting hub it
   *  matches the hub's own slug (peer-led-silent-meditation, etc).
   *  Resolved server-side in the parent page so this component doesn't
   *  need to know the mapping. */
  manualSlug: string;
}

export default function HostHubHomeClient({
  slug,
  hubName,
  canEditContent,
  welcomeHtml,
  welcomeBody,
  thisMonth,
  manualSlug,
}: Props) {
  const [editingWelcome, setEditingWelcome] = useState(false);

  return (
    <div className="hub-home">
      <header className="hub-home__header" style={{ position: "relative" }}>
        <div className="hub-home__greeting">Welcome</div>
        <h2 className="hub-home__state">{hubName}</h2>
        {/* Quiet "?" link to the orientation chapter for this hub. Same pattern
            as the schedule tool's hs-help-icon — discoverable without competing
            for visual weight. */}
        <a
          href={`/admin/manual/${manualSlug}?from=${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mh-icon"
          title={`About ${hubName}`}
          aria-label={`About ${hubName} (opens in a new tab)`}
          style={{ position: "absolute", top: 0, right: 0 }}
        >
          ?
        </a>
      </header>

      <section className="hub-home__section">
        <SectionLabel
          label="Welcome"
          canEdit={canEditContent && !editingWelcome}
          onEdit={() => setEditingWelcome(true)}
        />
        {editingWelcome ? (
          <InlineBlockEditor
            slug={slug}
            field="welcomeBody"
            initialValue={welcomeBody}
            placeholder="Welcome hosts to the team — what this work is, and what they can expect here."
            onDone={() => setEditingWelcome(false)}
          />
        ) : welcomeHtml ? (
          <div
            className="hub-home__orientation-body rim-content"
            dangerouslySetInnerHTML={{ __html: welcomeHtml }}
          />
        ) : (
          <div className="hub-home__empty-content">
            No welcome content yet.{" "}
            {canEditContent && (
              <button
                type="button"
                className="hub-home__empty-action"
                onClick={() => setEditingWelcome(true)}
              >
                Add one
              </button>
            )}
          </div>
        )}
      </section>

      <ThisMonthGlancePanel data={thisMonth} hubSlug={slug} />
    </div>
  );
}

/* ─────────────────  Our offerings this month panel  ─────────────────────────
   Shown to everyone. Sangha-friendly framing: work is collective, members
   not yet on the schedule are described as "available" — not absent. */

function ThisMonthGlancePanel({ data, hubSlug }: { data: ThisMonthGlance; hubSlug: string }) {
  if (data.totalSessions === 0 && data.hostingMembers.length === 0 && data.availableMembers.length === 0) {
    return null;
  }

  const hostingCount = data.hostingMembers.length;
  const sessionsLabel = data.totalSessions === 1 ? "session" : "sessions";
  const hostsLabel = hostingCount === 1 ? "host" : "hosts";

  return (
    <section className="hh-month">
      <div className="hh-month__heading">Our offerings this month</div>

      <p className="hh-month__summary">
        <strong>{data.totalSessions}</strong>{" "}
        {data.totalSessions === 1 ? "session" : "sessions"} in {data.monthLabel} ·{" "}
        <strong>{hostingCount}</strong> {hostsLabel} contributing
        {data.openSessions > 0 && (
          <>
            {" "}· <strong>{data.openSessions}</strong> still {data.openSessions === 1 ? "needs" : "need"} a host
          </>
        )}
        .
      </p>

      {data.hostingMembers.length > 0 && (
        <div className="hh-month__group">
          <div className="hh-month__group-label">Hosting</div>
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

/* ─────────────────────────  Helpers  ─────────────────────────── */

function SectionLabel({
  label,
  canEdit,
  onEdit,
}: {
  label: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="hub-home__section-label hub-home__section-label--with-action">
      <span>{label}</span>
      {canEdit && (
        <button
          type="button"
          className="hub-home__section-action"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
    </div>
  );
}

function InlineBlockEditor({
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

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/hub/${slug}/home`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    if (res.ok) {
      onDone();
      router.refresh();
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

