"use client";

/** Universal Space Home: stable core sections plus installed-app contributions. */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HubHomeApp } from "@/lib/hubApps";
import type { HubAttentionItem } from "@/lib/hubActivity";
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
  canEditContent: boolean;
  pinnedThreads: PinnedThread[];
  attention: HubAttentionItem[];
  homeContentHtml: string;
  homeContent: string;
  thisMonth: ThisMonthGlance | null;
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
    canEditContent,
    pinnedThreads,
    attention,
    homeContentHtml,
    homeContent,
    thisMonth,
  } = props;
  const [showWelcome, setShowWelcome] = useState(isNewcomer && hasWelcomeContent);
  const [dismissing, setDismissing] = useState(false);
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [editingOrientation, setEditingOrientation] = useState(false);
  const primaryApp = apps.find((app) => app.role === "primary") ?? null;
  const supportingApps = apps.filter((app) => app.role === "supporting");
  const connectedLinks = apps.filter((app) => app.role === "link");
  const primaryUsesModule = primaryApp?.homeMode === "module" && thisMonth;

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

      {attention.length > 0 && (
        <section className="hub-home__attention" aria-labelledby="hub-home-attention-heading">
          <div className="hub-home__section-label" id="hub-home-attention-heading">Needs your attention</div>
          <div className="hub-home-attention">
            {attention.map((item) => (
              <Link key={item.id} href={item.href} className="hub-home-attention__row">
                <span className="hub-home-attention__source">{item.sourceLabel}</span>
                <span className="hub-home-attention__label">{item.label}</span>
                <span className="hub-home-attention__cta">Open →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {primaryApp && !primaryUsesModule && (
        <section className="hub-home__section" aria-labelledby="hub-home-apps-heading">
          <div className="hub-home__section-label" id="hub-home-apps-heading">App</div>
          <div className="hub-home-apps">
            <AppCard app={primaryApp} hubSlug={slug} />
          </div>
        </section>
      )}

      {primaryUsesModule && <ThisMonthGlancePanel data={thisMonth} hubSlug={slug} />}

      {supportingApps.length > 0 && (
        <section className="hub-home__section" aria-labelledby="hub-home-supporting-apps-heading">
          <div className="hub-home__section-label" id="hub-home-supporting-apps-heading">More apps</div>
          <div className="hub-home-apps hub-home-apps--supporting">
            {supportingApps.map((app) => <AppCard key={app.key} app={app} hubSlug={slug} />)}
          </div>
        </section>
      )}

      {connectedLinks.length > 0 && (
        <section className="hub-home__section" aria-labelledby="hub-home-links-heading">
          <div className="hub-home__section-label" id="hub-home-links-heading">Links</div>
          <div className="hub-home-links">
            {connectedLinks.map((link) => (
              <Link key={link.key} href={link.path} className="hub-home-links__link">
                {link.label} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
    <Link href={href} className={`hub-home-card hub-home-card--${app.role}${hasCount ? " hub-home-card--active" : ""}`}>
      <div className="hub-home-card__inner">
        <div className="hub-home-card__label">
          {app.role === "primary" ? "Primary app" : app.role === "supporting" ? "Supporting app" : "Connected link"}
        </div>
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
