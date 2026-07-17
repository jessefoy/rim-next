"use client";

/** Universal Space Home: stable core sections plus installed-app contributions. */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HubHomeApp } from "@/lib/hubApps";
import type { HubActivityItem } from "@/lib/hubActivity";
import {
  InlineBlockEditor,
  ThisMonthGlancePanel,
  type ThisMonthGlance,
} from "@/components/HubHomeModules";

interface PinnedThread { id: string; title: string }

interface Props {
  slug: string;
  hubName: string;
  stateSentence: string;
  apps: HubHomeApp[];
  welcomeHeadline: string | null;
  welcomeBodyHtml: string;
  welcomeBody: string;
  isNewcomer: boolean;
  hasWelcomeContent: boolean;
  showWelcomeOnHome: boolean;
  canEditContent: boolean;
  pinnedThreads: PinnedThread[];
  recentActivity: HubActivityItem[];
  homeContentHtml: string;
  homeContent: string;
  thisMonth: ThisMonthGlance | null;
}

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HubHomeClient(props: Props) {
  const {
    slug,
    hubName,
    stateSentence,
    apps,
    welcomeHeadline,
    welcomeBodyHtml,
    welcomeBody,
    isNewcomer,
    hasWelcomeContent,
    showWelcomeOnHome,
    canEditContent,
    pinnedThreads,
    recentActivity,
    homeContentHtml,
    homeContent,
    thisMonth,
  } = props;
  const [showWelcome, setShowWelcome] = useState(isNewcomer && hasWelcomeContent);
  const [dismissing, setDismissing] = useState(false);
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [editingOrientation, setEditingOrientation] = useState(false);

  async function dismissWelcome() {
    setDismissing(true);
    try {
      await fetch(`/api/hubs/${slug}/membership/visited`, { method: "PATCH" });
    } catch {}
    setShowWelcome(false);
    setDismissing(false);
  }

  useEffect(() => {
    if (isNewcomer && !hasWelcomeContent) {
      fetch(`/api/hubs/${slug}/membership/visited`, { method: "PATCH" }).catch(() => {});
    }
  }, [isNewcomer, hasWelcomeContent, slug]);

  if (showWelcome) {
    return (
      <div className="hub-welcome">
        <div className="hub-welcome__card">
          <h1 className="hub-welcome__title">Welcome to {hubName}</h1>
          {welcomeHeadline && <p className="hub-welcome__headline">{welcomeHeadline}</p>}
          {welcomeBodyHtml && (
            <div className="hub-welcome__body rim-content" dangerouslySetInnerHTML={{ __html: welcomeBodyHtml }} />
          )}
          <button className="hub-welcome__btn" onClick={dismissWelcome} disabled={dismissing}>
            {dismissing ? "Loading…" : "Go to Home →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-home">
      <header className="hub-home__header">
        <div className="hub-home__greeting">{greeting()}.</div>
        <h1 className="hub-home__state">{stateSentence}</h1>
      </header>

      {showWelcomeOnHome && (
        <EditableContentSection
          label="Welcome"
          canEdit={canEditContent}
          editing={editingWelcome}
          onEdit={() => setEditingWelcome(true)}
          editor={
            <InlineBlockEditor
              slug={slug}
              field="welcomeBody"
              initialValue={welcomeBody}
              placeholder="Welcome this team to the Space and describe what they can expect here."
              onDone={() => setEditingWelcome(false)}
            />
          }
          html={welcomeBodyHtml}
          emptyText="No welcome content yet."
        />
      )}

      {apps.length > 0 && (
        <section className="hub-home__section" aria-labelledby="hub-home-apps-heading">
          <div className="hub-home__section-label" id="hub-home-apps-heading">Apps</div>
          <div className="hub-home-apps">
            {apps.map((app) => <AppCard key={app.key} app={app} hubSlug={slug} />)}
          </div>
        </section>
      )}

      {thisMonth && <ThisMonthGlancePanel data={thisMonth} hubSlug={slug} />}

      {pinnedThreads.length > 0 && (
        <section className="hub-home__section">
          <div className="hub-home__section-label">Pinned</div>
          <ul className="hub-home__pinned">
            {pinnedThreads.map((thread) => (
              <li key={thread.id}>
                <Link href={`/account/hub/${slug}/conversations/${thread.id}`} className="hub-home__pinned-link">
                  {thread.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentActivity.length > 0 && (
        <section className="hub-home__activity">
          <div className="hub-home-act">
            <div className="hub-home-act__head">
              <span className="hub-home-act__heading">Recent activity</span>
              <Link href={`/account/hub/${slug}/activity`} className="hub-home-act__view">View all</Link>
            </div>
            <div className="hub-home-act__body">
              {recentActivity.map((item) => (
                <Link key={item.id} href={item.href} className="hub-home-act__row">
                  <span className="hub-home-act__title">
                    {item.authorName} {item.verb}{item.subject ? ` ${item.subject}` : ""}
                  </span>
                  <span className="hub-home-act__meta">
                    {item.type === "app" ? "App" : item.type.charAt(0).toUpperCase() + item.type.slice(1)} · {relativeTime(item.ts)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <EditableContentSection
        label="Orientation"
        canEdit={canEditContent}
        editing={editingOrientation}
        onEdit={() => setEditingOrientation(true)}
        editor={
          <InlineBlockEditor
            slug={slug}
            field="homeContent"
            initialValue={homeContent}
            placeholder="Add long-lived context, practices, or guidance for this Space."
            onDone={() => setEditingOrientation(false)}
          />
        }
        html={homeContentHtml}
        emptyText="No orientation has been added yet."
      />
    </div>
  );
}

function AppCard({ app, hubSlug }: { app: HubHomeApp; hubSlug: string }) {
  const href = app.isRegistered
    ? `${app.path}${app.path.includes("?") ? "&" : "?"}hub=${encodeURIComponent(hubSlug)}`
    : app.path;
  const hasCount = app.count !== null && app.count > 0;
  return (
    <Link href={href} className={`hub-home-card${hasCount ? " hub-home-card--active" : ""}`}>
      <div className="hub-home-card__inner">
        <div className="hub-home-card__label">{app.isRegistered ? "Space app" : "Connected link"}</div>
        <div className="hub-home-card__headline">{app.label}</div>
        {hasCount ? (
          <div className="hub-home-card__count">
            <span className="hub-home-card__count-num">{app.count}</span>
            <span className="hub-home-card__count-word">{app.countLabel}</span>
          </div>
        ) : (
          <div className="hub-home-card__quiet">{app.quietText}</div>
        )}
        <div className="hub-home-card__cta">Open {app.label} →</div>
      </div>
    </Link>
  );
}

function EditableContentSection({
  label,
  canEdit,
  editing,
  onEdit,
  editor,
  html,
  emptyText,
}: {
  label: string;
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  editor: React.ReactNode;
  html: string;
  emptyText: string;
}) {
  if (!canEdit && !html) return null;
  return (
    <section className="hub-home__orientation">
      <div className="hub-home__section-label hub-home__section-label--with-action">
        <span>{label}</span>
        {canEdit && !editing && (
          <button type="button" className="hub-home__section-action" onClick={onEdit}>Edit</button>
        )}
      </div>
      {editing ? editor : html ? (
        <div className="hub-home__orientation-body rim-content" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="hub-home__empty-content">
          {emptyText} <button type="button" className="hub-home__empty-action" onClick={onEdit}>Add one</button>
        </div>
      )}
    </section>
  );
}
