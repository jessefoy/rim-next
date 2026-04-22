"use client";

/**
 * HostHubHomeClient — role-adaptive Hub Home for the Host Hub (Phase 5).
 *
 * The Host Hub is the first hub to get two distinct Home views:
 *   - Coordinator view: attention items, team directory (prose), quick links,
 *     coordinator notes.
 *   - Host view: welcome content, pinned threads, team roster, troubleshooting,
 *     quick links.
 *
 * Coordinators (and admins) can toggle into the host view to preview what
 * hosts see. The toggle is session-scoped — it does not persist.
 *
 * CSS prefix: hub-home- (shared) + hub-home-coord- / hub-home-host- variants.
 */

import { useState } from "react";
import Link from "next/link";

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

interface Props {
  slug: string;
  hubName: string;
  viewerRole: "coordinator" | "host";
  canToggle: boolean;
  coordinatorAttention: CoordinatorAttention | null;
  teamDirectoryHtml: string;
  welcomeHtml: string;
  pinnedThreads: PinnedThread[];
  teamRoster: RosterMember[];
}

export default function HostHubHomeClient({
  slug,
  hubName,
  viewerRole,
  canToggle,
  coordinatorAttention,
  teamDirectoryHtml,
  welcomeHtml,
  pinnedThreads,
  teamRoster,
}: Props) {
  const [previewAsHost, setPreviewAsHost] = useState(false);
  const activeView = canToggle && previewAsHost ? "host" : viewerRole;

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
        />
      ) : (
        <HostView
          slug={slug}
          hubName={hubName}
          welcomeHtml={welcomeHtml}
          pinnedThreads={pinnedThreads}
          teamRoster={teamRoster}
        />
      )}
    </div>
  );
}

/* ─────────────────────────  Coordinator view  ───────────────────────── */

function CoordinatorView({
  slug,
  hubName,
  attention,
  teamDirectoryHtml,
}: {
  slug: string;
  hubName: string;
  attention: CoordinatorAttention | null;
  teamDirectoryHtml: string;
}) {
  const allEmpty =
    !attention ||
    (attention.newHosts.length === 0 &&
      attention.unassignedPrograms.length === 0 &&
      attention.openSubs.length === 0 &&
      attention.newThreads.length === 0);

  return (
    <div className="hub-home-coord">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Coordinator view</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

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
      {teamDirectoryHtml && (
        <section className="hub-home__section">
          <div className="hub-home__section-label">Team directory</div>
          <div
            className="hub-home__orientation-body rim-content"
            dangerouslySetInnerHTML={{ __html: teamDirectoryHtml }}
          />
        </section>
      )}

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
  pinnedThreads,
  teamRoster,
}: {
  slug: string;
  hubName: string;
  welcomeHtml: string;
  pinnedThreads: PinnedThread[];
  teamRoster: RosterMember[];
}) {
  return (
    <div className="hub-home-host">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Welcome</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

      {welcomeHtml && (
        <section className="hub-home__section">
          <div className="hub-home__section-label">Welcome</div>
          <div
            className="hub-home__orientation-body rim-content"
            dangerouslySetInnerHTML={{ __html: welcomeHtml }}
          />
        </section>
      )}

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
