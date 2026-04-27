"use client";

/**
 * HostHubHomeClient — role-adaptive Hub Home for the Host Hub (Phase 5).
 *
 * Two distinct Home views:
 *   - Coordinator view: attention items, team directory (prose), quick links,
 *     coordinator notes.
 *   - Host view: welcome content, pinned threads, team roster, troubleshooting,
 *     quick links.
 *
 * Coordinators (and admins) can toggle into the host view to preview what
 * hosts see. Coordinators also have inline edit-in-place affordances on the
 * two authored sections (Welcome and Team directory) that swap the rendered
 * HTML for a BlockNote editor.
 *
 * CSS prefix: hub-home- (shared) + hub-home-coord- / hub-home-host- variants.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const RimBlockEditor = dynamic(() => import("@/components/RimBlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="hub-home__editor-loading">Loading editor…</div>
  ),
});

export interface CoordinatorAttention {
  newHosts: Array<{ id: string; userId: string; name: string; joinedAt: string }>;
  unassignedPrograms: Array<{ slug: string; name: string; startDatetime: string | null }>;
  openSubs: Array<{ id: string; programSlug: string; sessionDate: string | null; createdAt: string }>;
  newThreads: Array<{ id: string; title: string; authorName: string; createdAt: string }>;
}

export interface PinnedThread {
  id: string;
  title: string;
}

export interface RosterMember {
  id: string;
  userId: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  isCoordinator: boolean;
  bioHtml: string;
}

export interface ThisMonthGlance {
  monthLabel: string;
  totalSessions: number;
  openSessions: number;
  hostingMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
  availableMembers: Array<{ userId: string; name: string; count: number; isCoordinator: boolean }>;
}

type EditableField = "welcomeBody" | "homeContent";

interface Props {
  slug: string;
  hubName: string;
  viewerRole: "coordinator" | "host";
  canToggle: boolean;
  canEditContent: boolean;
  coordinatorAttention: CoordinatorAttention | null;
  teamDirectoryHtml: string;
  teamDirectoryJson: unknown;
  welcomeHtml: string;
  welcomeJson: unknown;
  pinnedThreads: PinnedThread[];
  teamRoster: RosterMember[];
  thisMonth: ThisMonthGlance;
}

export default function HostHubHomeClient({
  slug,
  hubName,
  viewerRole,
  canToggle,
  canEditContent,
  coordinatorAttention,
  teamDirectoryHtml,
  teamDirectoryJson,
  welcomeHtml,
  welcomeJson,
  pinnedThreads,
  teamRoster,
  thisMonth,
}: Props) {
  const [previewAsHost, setPreviewAsHost] = useState(false);
  const activeView = canToggle && previewAsHost ? "host" : viewerRole;

  const [editingField, setEditingField] = useState<EditableField | null>(null);

  return (
    <div className="hub-home">
      {canToggle && (
        <div className="hub-home-toggle">
          <span className="hub-home-toggle__label">Viewing as</span>
          <div className="hub-home-toggle__pills">
            <button
              type="button"
              className={`hub-home-toggle__pill${!previewAsHost ? " is-active" : ""}`}
              onClick={() => setPreviewAsHost(false)}
            >
              Coordinator
            </button>
            <button
              type="button"
              className={`hub-home-toggle__pill${previewAsHost ? " is-active" : ""}`}
              onClick={() => setPreviewAsHost(true)}
            >
              Host (preview)
            </button>
          </div>
        </div>
      )}

      {activeView === "coordinator" ? (
        <CoordinatorView
          slug={slug}
          hubName={hubName}
          attention={coordinatorAttention}
          teamDirectoryHtml={teamDirectoryHtml}
          teamDirectoryJson={teamDirectoryJson}
          canEditContent={canEditContent}
          editingField={editingField}
          setEditingField={setEditingField}
          thisMonth={thisMonth}
        />
      ) : (
        <HostView
          slug={slug}
          hubName={hubName}
          welcomeHtml={welcomeHtml}
          welcomeJson={welcomeJson}
          pinnedThreads={pinnedThreads}
          teamRoster={teamRoster}
          canEditContent={canEditContent}
          editingField={editingField}
          setEditingField={setEditingField}
          thisMonth={thisMonth}
        />
      )}
    </div>
  );
}

/* ────────────────────  Our offerings this month panel  ──────────────────────
   Shown above both the Coordinator and Host views. Sangha-friendly framing:
   work is collective ("we're holding"), participation is celebrated, and
   members not yet on the schedule are described as "available" — not absent.
   Splitting the list (hosting / available) keeps "0" out of any name's row.
─────────────────────────────────────────────────────────────────────────── */

function ThisMonthGlancePanel({ data }: { data: ThisMonthGlance }) {
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
                <span className="hh-month__pill-count" aria-label={`${m.count} ${m.count === 1 ? sessionsLabel : "sessions"}`}>
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
        <Link href="/tools/schedule" className="hh-month__cta">
          See the schedule →
        </Link>
      )}
    </section>
  );
}

/* ─────────────────────────  Coordinator view  ───────────────────────── */

function CoordinatorView({
  slug,
  hubName,
  attention,
  teamDirectoryHtml,
  teamDirectoryJson,
  canEditContent,
  editingField,
  setEditingField,
  thisMonth,
}: {
  slug: string;
  hubName: string;
  attention: CoordinatorAttention | null;
  teamDirectoryHtml: string;
  teamDirectoryJson: unknown;
  canEditContent: boolean;
  editingField: EditableField | null;
  setEditingField: (f: EditableField | null) => void;
  thisMonth: ThisMonthGlance;
}) {
  const allEmpty =
    !attention ||
    (attention.newHosts.length === 0 &&
      attention.unassignedPrograms.length === 0 &&
      attention.openSubs.length === 0 &&
      attention.newThreads.length === 0);

  const editingTeamDirectory = editingField === "homeContent";

  return (
    <div className="hub-home-coord">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Coordinator view</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

      <ThisMonthGlancePanel data={thisMonth} />

      {/* ── Attention items ── */}
      <section className="hub-home__section">
        <div className="hub-home__section-label">Needs attention</div>
        {allEmpty ? (
          <div className="hub-home-coord__empty">Everything&rsquo;s handled.</div>
        ) : (
          <div className="hub-home-coord__attention">
            {attention && attention.newHosts.length > 0 && (
              <AttentionCard
                heading="Pending new hosts"
                hint="Joined in the last 7 days — worth a welcome note."
                viewAllHref={`/account/hub/${slug}/members`}
                viewAllLabel="Open team"
              >
                {attention.newHosts.map((h) => (
                  <AttentionRow
                    key={h.id}
                    href={`/account/hub/${slug}/members`}
                    title={h.name}
                    meta={`Joined ${relativeTime(h.joinedAt)}`}
                  />
                ))}
              </AttentionCard>
            )}

            {attention && attention.unassignedPrograms.length > 0 && (
              <AttentionCard
                heading="Unassigned virtual/hybrid programs"
                hint="No standing host within the next 30 days."
                viewAllHref="/tools/schedule"
                viewAllLabel="Open schedule"
              >
                {attention.unassignedPrograms.map((p) => (
                  <AttentionRow
                    key={p.slug}
                    href={`/tools/programs/${p.slug}`}
                    title={p.name}
                    meta={
                      p.startDatetime
                        ? `Next occurrence ${formatDate(p.startDatetime)}`
                        : "Upcoming"
                    }
                  />
                ))}
              </AttentionCard>
            )}

            {attention && attention.openSubs.length > 0 && (
              <AttentionCard
                heading="Unclaimed sub requests"
                hint="OPEN — a host has asked for coverage."
                viewAllHref="/tools/schedule"
                viewAllLabel="Open schedule"
              >
                {attention.openSubs.map((s) => (
                  <AttentionRow
                    key={s.id}
                    href="/tools/schedule"
                    title={s.programSlug}
                    meta={
                      (s.sessionDate ? formatDate(s.sessionDate) : "Session TBD") +
                      ` · requested ${relativeTime(s.createdAt)}`
                    }
                  />
                ))}
              </AttentionCard>
            )}

            {attention && attention.newThreads.length > 0 && (
              <AttentionCard
                heading="New conversations"
                hint="Posted since your last visit."
                viewAllHref={`/account/hub/${slug}/conversations`}
                viewAllLabel="Open conversations"
              >
                {attention.newThreads.map((t) => (
                  <AttentionRow
                    key={t.id}
                    href={`/account/hub/${slug}/conversations/${t.id}`}
                    title={t.title}
                    meta={`${t.authorName} · ${relativeTime(t.createdAt)}`}
                  />
                ))}
              </AttentionCard>
            )}
          </div>
        )}
      </section>

      {/* ── Team directory (hub.homeContent) ── */}
      <section className="hub-home__section">
        <SectionLabel
          label="Team directory"
          canEdit={canEditContent && !editingTeamDirectory && editingField === null}
          onEdit={() => setEditingField("homeContent")}
        />
        {editingTeamDirectory ? (
          <InlineBlockEditor
            slug={slug}
            field="homeContent"
            initialValue={teamDirectoryJson}
            placeholder="Describe who does what on this team — roles, responsibilities, how the shape of things stands today."
            onDone={() => setEditingField(null)}
          />
        ) : teamDirectoryHtml ? (
          <div
            className="hub-home__orientation-body rim-content"
            dangerouslySetInnerHTML={{ __html: teamDirectoryHtml }}
          />
        ) : (
          <div className="hub-home__empty-content">
            No team directory yet.{" "}
            {canEditContent && (
              <button
                type="button"
                className="hub-home__empty-action"
                onClick={() => setEditingField("homeContent")}
              >
                Add one
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Quick links ── */}
      <section className="hub-home__section">
        <div className="hub-home__section-label">Quick links</div>
        <ul className="hub-home-coord__quicklinks">
          <li>
            <Link href="/tools/schedule">Host schedule</Link>
            <span> — assignments, sub requests, diagnostics</span>
          </li>
          <li>
            <Link href={`/account/hub/${slug}/members`}>Team management</Link>
            <span> — add, pause, or revoke hosting</span>
          </li>
          <li>
            <Link href={`/account/hub/${slug}/conversations`}>Conversations</Link>
            <span> — hub-wide discussion</span>
          </li>
          <li>
            <Link href="/admin/manual/host-hub-team-management">
              Team management manual
            </Link>
            <span> — coordinator playbook</span>
          </li>
        </ul>
      </section>

      {/* ── Coordinator notes ── */}
      <section className="hub-home__section">
        <div className="hub-home__section-label">Coordinator notes</div>
        <div className="hub-home-coord__notes-placeholder">
          Private-to-coordinators notes area — use{" "}
          <Link href={`/account/hub/${slug}/documents`}>Documents</Link>{" "}
          for now; a dedicated inline editor will land with a later iteration.
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────  Host view  ───────────────────────── */

function HostView({
  slug,
  hubName,
  welcomeHtml,
  welcomeJson,
  pinnedThreads,
  teamRoster,
  canEditContent,
  editingField,
  setEditingField,
  thisMonth,
}: {
  slug: string;
  hubName: string;
  welcomeHtml: string;
  welcomeJson: unknown;
  pinnedThreads: PinnedThread[];
  teamRoster: RosterMember[];
  canEditContent: boolean;
  editingField: EditableField | null;
  setEditingField: (f: EditableField | null) => void;
  thisMonth: ThisMonthGlance;
}) {
  const editingWelcome = editingField === "welcomeBody";

  return (
    <div className="hub-home-host">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Welcome</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

      <ThisMonthGlancePanel data={thisMonth} />

      <section className="hub-home__section">
        <SectionLabel
          label="Welcome"
          canEdit={canEditContent && !editingWelcome && editingField === null}
          onEdit={() => setEditingField("welcomeBody")}
        />
        {editingWelcome ? (
          <InlineBlockEditor
            slug={slug}
            field="welcomeBody"
            initialValue={welcomeJson}
            placeholder="Welcome hosts to the team — what this work is, and what they can expect here."
            onDone={() => setEditingField(null)}
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
                onClick={() => setEditingField("welcomeBody")}
              >
                Add one
              </button>
            )}
          </div>
        )}
      </section>

      {pinnedThreads.length > 0 && (
        <section className="hub-home__section">
          <div className="hub-home__section-label">Pinned</div>
          <ul className="hub-home__pinned">
            {pinnedThreads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/account/hub/${slug}/conversations/${t.id}`}
                  className="hub-home__pinned-link"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {teamRoster.length > 0 && (
        <section className="hub-home__section">
          <div className="hub-home__section-label">Your team</div>
          <div className="hub-roster">
            {teamRoster.map((m) => (
              <RosterCard key={m.id} member={m} />
            ))}
          </div>
        </section>
      )}

      <section className="hub-home__section">
        <div className="hub-home__section-label">If something goes wrong</div>
        <div className="hub-home-host__trouble">
          <p>
            <strong>Locked out of a session?</strong> Open the session link in a
            different browser or incognito window — a stale auth state is almost
            always the cause.
          </p>
          <p>
            <strong>Need coverage for a shift?</strong> File a{" "}
            <Link href="/tools/schedule">sub request</Link> from the schedule
            card. Another host can claim it.
          </p>
          <p>
            <strong>Something you can&rsquo;t work out on your own?</strong>{" "}
            Post in{" "}
            <Link href={`/account/hub/${slug}/conversations`}>Conversations</Link>{" "}
            — a coordinator will see it.
          </p>
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Quick links</div>
        <ul className="hub-home-host__quicklinks">
          <li>
            <Link href="/tools/schedule">Your schedule</Link>
            <span> — upcoming sessions + sub requests</span>
          </li>
          <li>
            <Link href={`/account/hub/${slug}/conversations`}>Conversations</Link>
            <span> — hub-wide discussion</span>
          </li>
          <li>
            <Link href={`/account/hub/${slug}/documents`}>Documents</Link>
            <span> — playbooks + references</span>
          </li>
          <li>
            <Link href="/account/settings">Presence photo</Link>
            <span> — shown to attendees in video sessions</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function RosterCard({ member }: { member: RosterMember }) {
  const initials =
    member.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·";

  return (
    <div className="hub-roster-card">
      <div
        className={`hub-roster-card__avatar${member.avatarUrl ? "" : " hub-roster-card__avatar--placeholder"}`}
        style={
          member.avatarUrl
            ? { backgroundImage: `url(${encodeURI(member.avatarUrl)})` }
            : undefined
        }
        aria-hidden="true"
      >
        {member.avatarUrl ? null : initials}
      </div>
      <div className="hub-roster-card__body">
        <div className="hub-roster-card__name">
          {member.name}
          {member.isCoordinator && (
            <span className="hub-roster-card__badge">Coordinator</span>
          )}
        </div>
        {member.title && (
          <div className="hub-roster-card__title">{member.title}</div>
        )}
        {member.bioHtml && (
          <div
            className="hub-roster-card__bio rim-content"
            dangerouslySetInnerHTML={{ __html: member.bioHtml }}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────  Section label w/ edit  ───────────────────────── */

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
          className="hub-home__edit-link"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
        >
          Edit
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────  Inline editor  ───────────────────────── */

type SaveState = "idle" | "saving" | "saved" | "error";

function InlineBlockEditor({
  slug,
  field,
  initialValue,
  placeholder,
  onDone,
}: {
  slug: string;
  field: EditableField;
  initialValue: unknown;
  placeholder: string;
  onDone: () => void;
}) {
  const router = useRouter();

  // Normalize the initial value into a stable JSON string for dirty detection.
  const initialJson = JSON.stringify(initialValue ?? null);
  const [value, setValue] = useState<unknown>(initialValue ?? undefined);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDirty = JSON.stringify(value ?? null) !== initialJson;

  // Warn on navigation with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/hubs/${slug}/home`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value ?? null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSaveState("saved");
      router.refresh();
      // Give the "Saved" affordance a beat to be seen, then close.
      setTimeout(() => {
        onDone();
      }, 600);
    } catch (err) {
      setSaveState("error");
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  function handleCancel() {
    if (isDirty) {
      const ok = window.confirm(
        "Discard your unsaved changes to this section?",
      );
      if (!ok) return;
    }
    onDone();
  }

  const saving = saveState === "saving";

  return (
    <div className="hub-home__inline-editor">
      <div className="hub-home__inline-editor-surface">
        <RimBlockEditor
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          minHeight={240}
          context="document"
        />
      </div>
      <div className="hub-home__inline-editor-footer">
        {errorMsg && (
          <span className="hub-home__inline-editor-error">{errorMsg}</span>
        )}
        {saveState === "saved" && (
          <span className="hub-home__inline-editor-saved">Saved</span>
        )}
        <div className="hub-home__inline-editor-actions">
          <button
            type="button"
            className="hub-home__inline-editor-cancel"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hub-home__inline-editor-save"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  Attention bits  ───────────────────────── */

function AttentionCard({
  heading,
  hint,
  viewAllHref,
  viewAllLabel,
  children,
}: {
  heading: string;
  hint: string;
  viewAllHref: string;
  viewAllLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hub-home-att">
      <div className="hub-home-att__head">
        <span className="hub-home-att__heading">{heading}</span>
        <Link href={viewAllHref} className="hub-home-att__view">
          {viewAllLabel}
        </Link>
      </div>
      <div className="hub-home-att__hint">{hint}</div>
      <div className="hub-home-att__body">{children}</div>
    </div>
  );
}

function AttentionRow({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta: string;
}) {
  return (
    <Link href={href} className="hub-home-att__row">
      <span className="hub-home-att__title">{title}</span>
      <span className="hub-home-att__meta">{meta}</span>
    </Link>
  );
}

/* ─────────────────────────  Date helpers  ───────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
