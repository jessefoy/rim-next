"use client";

/**
 * HubHomeClient — Hub Home screen (session 87 redesign).
 *
 * Shape:
 *   ┌─────────────────────────────────────────────┐
 *   │  [Greeting] (small)                         │
 *   │  [State sentence] (h2, plain-language)      │
 *   │                                             │
 *   │  ┌───────────────────────────────────────┐  │
 *   │  │  Primary work card                    │  │  ← visually dominant
 *   │  │  (tool name · count · "Open tool →")  │  │    for tool hubs
 *   │  └───────────────────────────────────────┘  │
 *   │                                             │
 *   │  [Pinned threads] (if any)                  │
 *   │                                             │
 *   │  [Activity rail: convs · your tasks · docs] │
 *   │                                             │
 *   │  [Orientation block] (if homeContent set)   │
 *   └─────────────────────────────────────────────┘
 *
 * Coordinator home-content editor has moved to /admin/hubs/[slug]/edit.
 * Hub description + coordinator names have moved to the workspace sidebar.
 *
 * CSS prefix: hub-home-
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface PrimaryTool {
  label: string;
  path: string;
  count: number;
  label_short: string;
}

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

interface RecentDoc {
  id: string;
  label: string;
  isNative: boolean;
  updatedAt: string;
}

interface Props {
  slug: string;
  hubName: string;
  stateSentence: string;
  primaryTool: PrimaryTool | null;
  welcomeHeadline: string | null;
  welcomeBodyHtml: string;
  isNewcomer: boolean;
  hasWelcomeContent: boolean;
  pinnedThreads: PinnedThread[];
  recentThreads: RecentThread[];
  recentDocs: RecentDoc[];
  homeContentHtml: string;
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

export default function HubHomeClient({
  slug,
  hubName,
  stateSentence,
  primaryTool,
  welcomeHeadline,
  welcomeBodyHtml,
  isNewcomer,
  hasWelcomeContent,
  pinnedThreads,
  recentThreads,
  recentDocs,
  homeContentHtml,
}: Props) {
  const [showWelcome, setShowWelcome] = useState(isNewcomer && hasWelcomeContent);
  const [dismissing, setDismissing] = useState(false);

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

  // Fire visited if newcomer but no welcome content
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
            <div
              className="hub-welcome__body rim-content"
              dangerouslySetInnerHTML={{ __html: welcomeBodyHtml }}
            />
          )}
          <button className="hub-welcome__btn" onClick={dismissWelcome} disabled={dismissing}>
            {dismissing ? "Loading..." : "Go to hub \u2192"}
          </button>
        </div>
      </div>
    );
  }

  // Per-hub orientation chapter for the "?" link in the header.
  // host-team is handled by HostHubHomeClient, so it's not in this map.
  const orientationManualSlug: Record<string, string> = {
    courses:   "course-hub",
    support:   "support-inbox",
    registrar: "registration",
  };
  const manualSlug = orientationManualSlug[slug];

  return (
    <div className="hub-home">
      {/* ── State sentence ── */}
      <header className="hub-home__header" style={{ position: "relative" }}>
        <div className="hub-home__greeting">{greeting()}.</div>
        <h2 className="hub-home__state">{stateSentence}</h2>
        {manualSlug && (
          <a
            href={`/admin/manual/${manualSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mh-icon"
            title={`About ${hubName}`}
            aria-label={`About ${hubName} (opens in a new tab)`}
            style={{ position: "absolute", top: 0, right: 0 }}
          >
            ?
          </a>
        )}
      </header>

      {/* ── Primary work card ── */}
      {primaryTool && (
        <PrimaryToolCard tool={primaryTool} hubSlug={slug} />
      )}

      {/* ── Pinned ── */}
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

      {/* ── Activity rail ── */}
      {(recentThreads.length > 0 || recentDocs.length > 0) && (
        <section className="hub-home__activity">
          {recentThreads.length > 0 && (
            <ActivityCard
              heading="Recent conversations"
              viewAllHref={`/account/hub/${slug}/conversations`}
            >
              {recentThreads.map((t) => (
                <ActivityRow
                  key={t.id}
                  href={`/account/hub/${slug}/conversations/${t.id}`}
                  title={t.title}
                  meta={`${t.authorName} · ${t.replyCount} ${
                    t.replyCount === 1 ? "reply" : "replies"
                  } · ${relativeTime(t.updatedAt)}`}
                />
              ))}
            </ActivityCard>
          )}

          {recentDocs.length > 0 && (
            <ActivityCard
              heading="Recent documents"
              viewAllHref={`/account/hub/${slug}/documents`}
            >
              {recentDocs.map((d) => (
                <ActivityRow
                  key={d.id}
                  href={
                    d.isNative
                      ? `/account/hub/${slug}/documents/${d.id}`
                      : `/account/hub/${slug}/documents`
                  }
                  title={d.label}
                  meta={relativeTime(d.updatedAt)}
                />
              ))}
            </ActivityCard>
          )}
        </section>
      )}

      {/* ── Orientation ── */}
      {homeContentHtml && (
        <section className="hub-home__orientation">
          <div className="hub-home__section-label">Orientation</div>
          <div
            className="hub-home__orientation-body rim-content"
            dangerouslySetInnerHTML={{ __html: homeContentHtml }}
          />
        </section>
      )}
    </div>
  );
}

/* ─────────────────────────  Primary tool card  ───────────────────────── */

function PrimaryToolCard({ tool, hubSlug }: { tool: PrimaryTool; hubSlug: string }) {
  // useSearchParams ensures the link receives the current hub context on nav
  const searchParams = useSearchParams();
  const currentHub = searchParams.get("hub") ?? hubSlug;
  const href = tool.path + (tool.path.includes("?") ? "&" : "?") + `hub=${currentHub}`;

  const hasWork = tool.count > 0;

  return (
    <Link href={href} className={`hub-home-card${hasWork ? " hub-home-card--active" : ""}`}>
      <div className="hub-home-card__inner">
        <div className="hub-home-card__label">Your primary workspace</div>
        <div className="hub-home-card__headline">{tool.label}</div>
        {hasWork ? (
          <div className="hub-home-card__count">
            <span className="hub-home-card__count-num">{tool.count}</span>
            <span className="hub-home-card__count-word">{tool.label_short}</span>
          </div>
        ) : (
          <div className="hub-home-card__quiet">Nothing needs review right now.</div>
        )}
        <div className="hub-home-card__cta">Open {tool.label} →</div>
      </div>
    </Link>
  );
}

/* ─────────────────────────  Activity bits  ───────────────────────── */

function ActivityCard({
  heading,
  viewAllHref,
  children,
}: {
  heading: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hub-home-act">
      <div className="hub-home-act__head">
        <span className="hub-home-act__heading">{heading}</span>
        <Link href={viewAllHref} className="hub-home-act__view">
          View all
        </Link>
      </div>
      <div className="hub-home-act__body">{children}</div>
    </div>
  );
}

function ActivityRow({
  href,
  title,
  meta,
}: {
  href?: string;
  title: string;
  meta: string;
}) {
  const inner = (
    <>
      <span className="hub-home-act__title">{title}</span>
      <span className="hub-home-act__meta">{meta}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="hub-home-act__row">
        {inner}
      </Link>
    );
  }
  return <div className="hub-home-act__row">{inner}</div>;
}
