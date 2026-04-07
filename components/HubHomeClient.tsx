"use client";

/**
 * HubHomeClient — Hub Home tab with optional newcomer welcome interstitial
 * and activity summary (recent conversations, tasks, documents).
 * CSS prefix: hub-home-, hub-welcome-
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import RimProseEditor from "@/components/RimProseEditor";

interface PinnedThread {
  id: string;
  title: string;
}

interface RecentThread {
  id: string;
  title: string;
  authorName: string;
  replyCount: number;
  updatedAt: string;
}

interface OpenTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
}

interface RecentDoc {
  id: string;
  label: string;
  isNative: boolean;
  updatedAt: string;
}

interface Props {
  slug: string;
  hubName: string;
  description: string | null;
  coordinatorNames: string[];
  pinnedThreads: PinnedThread[];
  homeContentHtml: string;
  homeContentJson: any;
  welcomeHeadline: string | null;
  welcomeBodyHtml: string;
  isNewcomer: boolean;
  hasWelcomeContent: boolean;
  isCoordinator: boolean;
  recentThreads: RecentThread[];
  openTasks: OpenTask[];
  recentDocs: RecentDoc[];
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

export default function HubHomeClient({
  slug,
  hubName,
  description,
  coordinatorNames,
  pinnedThreads,
  homeContentHtml,
  homeContentJson,
  welcomeHeadline,
  welcomeBodyHtml,
  isNewcomer,
  hasWelcomeContent,
  isCoordinator,
  recentThreads,
  openTasks,
  recentDocs,
}: Props) {
  const [showWelcome, setShowWelcome] = useState(isNewcomer && hasWelcomeContent);
  const [dismissing, setDismissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState<any>(homeContentJson);
  const [savingHome, setSavingHome] = useState(false);
  const [currentHtml, setCurrentHtml] = useState(homeContentHtml);

  async function dismissWelcome() {
    setDismissing(true);
    try {
      await fetch(`/api/hubs/${slug}/membership/visited`, { method: "PATCH" });
    } catch {
      // silently continue
    }
    setShowWelcome(false);
    setDismissing(false);
  }

  async function saveHomeContent() {
    setSavingHome(true);
    try {
      const res = await fetch(`/api/hubs/${slug}/home`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeContent: editContent }),
      });
      if (res.ok) {
        setEditing(false);
        window.location.reload();
      }
    } finally {
      setSavingHome(false);
    }
  }

  // ── Welcome interstitial ──
  if (showWelcome) {
    return (
      <div className="hub-welcome">
        <div className="hub-welcome__card">
          <h1 className="hub-welcome__title">Welcome to {hubName}</h1>
          {welcomeHeadline && (
            <p className="hub-welcome__headline">{welcomeHeadline}</p>
          )}
          {welcomeBodyHtml && (
            <div
              className="hub-welcome__body"
              dangerouslySetInnerHTML={{ __html: welcomeBodyHtml }}
            />
          )}
          <button
            className="hub-welcome__btn"
            onClick={dismissWelcome}
            disabled={dismissing}
          >
            {dismissing ? "Loading..." : "Go to hub \u2192"}
          </button>
        </div>
      </div>
    );
  }

  // ── If newcomer but no welcome content, fire visited API silently ──
  useEffect(() => {
    if (isNewcomer && !hasWelcomeContent) {
      fetch(`/api/hubs/${slug}/membership/visited`, { method: "PATCH" }).catch(() => {});
    }
  }, [isNewcomer, hasWelcomeContent, slug]);

  const hasActivity = recentThreads.length > 0 || openTasks.length > 0 || recentDocs.length > 0;

  // ── Normal Home screen ──
  return (
    <div className="hub-home">
      <div className="hub-home__top">
        <div className="hub-home__top-text">
          {description && (
            <p className="hub-home__description">{description}</p>
          )}
          {coordinatorNames.length > 0 && (
            <p className="hub-home__coordinator">
              Coordinated by {coordinatorNames.join(", ")}
            </p>
          )}
        </div>
        {isCoordinator && !editing && (
          <button className="hub-home__edit-btn" onClick={() => setEditing(true)}>
            Edit home
          </button>
        )}
      </div>

      {/* Edit panel (coordinator only) */}
      {editing && (
        <div className="hub-home__edit-panel">
          <div className="hub-home__edit-label">Home Content</div>
          <RimProseEditor
            value={editContent}
            onChange={setEditContent}
            variant="document"
            placeholder="Add orientation notes, important links, or team info..."
            minHeight={160}
          />
          <div className="hub-home__edit-actions">
            <button className="btn" onClick={saveHomeContent} disabled={savingHome}>
              {savingHome ? "Saving..." : "Save"}
            </button>
            <button
              className="btn--ghost"
              onClick={() => { setEditContent(homeContentJson); setEditing(false); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pinned threads */}
      {pinnedThreads.length > 0 && (
        <div className="hub-home__section">
          <div className="hub-home__section-label">Pinned</div>
          <ul className="hub-home__pinned-list">
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
        </div>
      )}

      {/* Home content (rendered) */}
      {currentHtml && !editing && (
        <div className="hub-home__section">
          <div
            className="hub-home__content-body"
            dangerouslySetInnerHTML={{ __html: currentHtml }}
          />
        </div>
      )}

      {/* Activity summary */}
      {hasActivity && (
        <div className="hub-home-activity">
          {/* Recent conversations */}
          {recentThreads.length > 0 && (
            <div className="hub-home-activity__card">
              <div className="hub-home-activity__card-header">
                <span className="hub-home-activity__card-heading">Recent Conversations</span>
                <Link href={`/account/hub/${slug}/conversations`} className="hub-home-activity__view-all">
                  View all
                </Link>
              </div>
              {recentThreads.map((t) => (
                <Link key={t.id} href={`/account/hub/${slug}/conversations/${t.id}`} className="hub-home-activity__row">
                  <span className="hub-home-activity__title">{t.title}</span>
                  <span className="hub-home-activity__meta">
                    {t.authorName} &middot; {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"} &middot; {relativeTime(t.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Open tasks */}
          {openTasks.length > 0 && (
            <div className="hub-home-activity__card">
              <div className="hub-home-activity__card-header">
                <span className="hub-home-activity__card-heading">Your Tasks</span>
                <Link href={`/account/hub/${slug}/tasks`} className="hub-home-activity__view-all">
                  View all
                </Link>
              </div>
              {openTasks.map((t) => (
                <div key={t.id} className="hub-home-activity__row">
                  <span className="hub-home-activity__title">{t.title}</span>
                  <span className="hub-home-activity__meta">
                    {t.status === "IN_PROGRESS" ? "In progress" : "Open"}
                    {t.dueDate && <> &middot; Due {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recent documents */}
          {recentDocs.length > 0 && (
            <div className="hub-home-activity__card">
              <div className="hub-home-activity__card-header">
                <span className="hub-home-activity__card-heading">Recent Documents</span>
                <Link href={`/account/hub/${slug}/documents`} className="hub-home-activity__view-all">
                  View all
                </Link>
              </div>
              {recentDocs.map((d) => (
                <Link
                  key={d.id}
                  href={d.isNative ? `/account/hub/${slug}/documents/${d.id}` : `/account/hub/${slug}/documents`}
                  className="hub-home-activity__row"
                >
                  <span className="hub-home-activity__title">{d.label}</span>
                  <span className="hub-home-activity__meta">{relativeTime(d.updatedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
