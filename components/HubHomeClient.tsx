"use client";

/**
 * HubHomeClient — Hub Home tab with optional newcomer welcome interstitial.
 * CSS prefix: hub-home-, hub-welcome-
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import RimProseEditor from "@/components/RimProseEditor";
import { getToolBySlug } from "@/lib/toolRegistry";

interface PinnedThread {
  id: string;
  title: string;
}

interface AppLink {
  toolSlug: string | null;
  label: string;
  href: string;
}

interface Props {
  slug: string;
  hubName: string;
  description: string | null;
  coordinatorNames: string[];
  pinnedThreads: PinnedThread[];
  appLinks: AppLink[];
  homeContentHtml: string;
  homeContentJson: any;
  welcomeHeadline: string | null;
  welcomeBodyHtml: string;
  isNewcomer: boolean;
  hasWelcomeContent: boolean;
  isCoordinator: boolean;
}

export default function HubHomeClient({
  slug,
  hubName,
  description,
  coordinatorNames,
  pinnedThreads,
  appLinks,
  homeContentHtml,
  homeContentJson,
  welcomeHeadline,
  welcomeBodyHtml,
  isNewcomer,
  hasWelcomeContent,
  isCoordinator,
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
      // silently continue — worst case they see it again
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
        // Re-render will happen on next nav; for now update local html
        // We can't easily re-render server HTML client-side, but the content
        // is saved. Close the editor and show a success note.
        setEditing(false);
        // Force a soft refresh to get fresh server-rendered HTML
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
            <button
              className="btn"
              onClick={saveHomeContent}
              disabled={savingHome}
            >
              {savingHome ? "Saving..." : "Save"}
            </button>
            <button
              className="btn--ghost"
              onClick={() => {
                setEditContent(homeContentJson);
                setEditing(false);
              }}
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

      {/* App links */}
      {appLinks.length > 0 && (
        <div className="hub-home__section">
          <div className="hub-home__section-label">Tools</div>
          <div className="hub-home__links">
            {appLinks.map((link, i) => {
              const basePath = link.toolSlug
                ? (getToolBySlug(link.toolSlug)?.path ?? link.href)
                : link.href;
              const isExternal = basePath.startsWith("http");
              const toolHref = isExternal
                ? basePath
                : basePath.includes("?")
                  ? `${basePath}&hub=${slug}`
                  : `${basePath}?hub=${slug}`;
              return (
                <a
                  key={i}
                  href={toolHref}
                  className="hub-home__link-item"
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
