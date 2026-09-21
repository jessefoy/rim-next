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
  filesEnabled: boolean;
  conversationsEnabled: boolean;
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

export default function HubHomeClient(props: Props) {
  const {
    slug,
    hubName, filesEnabled, conversationsEnabled,
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
        <h1 className="ac-page-title">{hubName}</h1>
        <p className="ac-page-sub">Your team’s shared space.</p>
      </header>

      <nav aria-label="Team destinations"><ul className="rim-destination-list">
        {conversationsEnabled && <li><Link href={`/account/hub/${slug}/conversations`}><span>Conversations<small>Read and join team discussions</small></span><span aria-hidden="true">→</span></Link></li>}
        {filesEnabled && <li><Link href={`/account/hub/${slug}/files`}><span>Files<small>Find documents and shared resources</small></span><span aria-hidden="true">→</span></Link></li>}
        <li><Link href={`/account/hub/${slug}/members`}><span>Members<small>Find the people on your team</small></span><span aria-hidden="true">→</span></Link></li>
        {[...(primaryApp ? [primaryApp] : []), ...supportingApps].map(app => <li key={app.key}><AppCard app={app} hubSlug={slug} /></li>)}
      </ul></nav>

      {attention.length > 0 && (
        <details className="rim-disclosure hub-home__attention">
          <summary>{attention.length} {attention.length === 1 ? "item needs" : "items need"} your attention</summary>
          <div className="hub-home-attention">
            {attention.map((item) => (
              <Link key={item.id} href={item.href} className="hub-home-attention__row">
                <span className="hub-home-attention__source">{item.sourceLabel}</span>
                <span className="hub-home-attention__label">{item.label}</span>
                <span className="hub-home-attention__cta">Open →</span>
              </Link>
            ))}
          </div>
        </details>
      )}

      {(canEditContent || welcomeBodyHtml || connectedLinks.length > 0) && <details className="rim-disclosure"><summary>About this team</summary>
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

      </details>}

      {thisMonth && <details className="rim-disclosure"><summary>Team schedule overview</summary><ThisMonthGlancePanel data={thisMonth} hubSlug={slug} /></details>}

      {pinnedThreads.length > 0 && (
        <details className="rim-disclosure">
          <summary>Pinned conversations</summary>
          <ul className="hub-home__pinned">
            {pinnedThreads.map((thread) => (
              <li key={thread.id}>
                <Link href={`/account/hub/${slug}/conversations/${thread.id}`} className="hub-home__pinned-link">
                  {thread.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {(canEditContent || homeContentHtml) && <details className="rim-disclosure"><summary>Team guidance</summary>
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
      </details>}
    </div>
  );
}

function AppCard({ app, hubSlug }: { app: HubHomeApp; hubSlug: string }) {
  const href = app.isRegistered
    ? `${app.path}${app.path.includes("?") ? "&" : "?"}hub=${encodeURIComponent(hubSlug)}`
    : app.path;
  return <Link href={href}><span>{app.label}<small>Open this team’s {app.label.toLowerCase()}</small></span><span aria-hidden="true">→</span></Link>;
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
