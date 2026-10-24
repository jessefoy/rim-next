"use client";

/**
 * Team Home, the standard for every team (Jesse, 2026-10-13): the team's
 * name and its own line (edited by its leads), the team's tool when it has
 * one (highlighted first, with its one summary line and one button), then
 * the destinations the rail also lists, and any personal attention.
 *
 * Retired the same day: the first-visit welcome screen, "About this team",
 * the Scheduler's month overview, pinned conversations and "Team guidance".
 * Pinned topics lead the Conversations list; the tool lives in the card.
 */

import Link from "next/link";
import type { HubHomeApp } from "@/lib/hubApps";
import type { HubAttentionItem } from "@/lib/hubActivity";
import { TeamLine } from "@/components/HubHomeModules";

interface Props {
  slug: string;
  hubName: string;
  line: string | null;
  canEditLine: boolean;
  filesEnabled: boolean;
  conversationsEnabled: boolean;
  apps: HubHomeApp[];
  attention: HubAttentionItem[];
}

function appHref(app: HubHomeApp, hubSlug: string) {
  return app.isRegistered
    ? `${app.path}${app.path.includes("?") ? "&" : "?"}hub=${encodeURIComponent(hubSlug)}`
    : app.path;
}

export default function HubHomeClient({
  slug,
  hubName,
  line,
  canEditLine,
  filesEnabled,
  conversationsEnabled,
  apps,
  attention,
}: Props) {
  const primaryApp = apps.find((app) => app.role === "primary") ?? null;
  const otherApps = apps.filter((app) => app.role !== "primary");

  return (
    <div className="hub-home">
      <header className="hub-home__header">
        <h1 className="ac-page-title">{hubName}</h1>
        <TeamLine slug={slug} line={line} canEdit={canEditLine} />
      </header>

      {primaryApp && (
        <section className="hub-tool" aria-labelledby="hub-tool-title">
          <p className="hub-tool__label">This team&rsquo;s tool</p>
          <h2 className="hub-tool__title" id="hub-tool-title">{primaryApp.label}</h2>
          <p className="hub-tool__summary">
            {primaryApp.count && primaryApp.countLabel
              ? `${primaryApp.count} ${primaryApp.countLabel}`
              : primaryApp.quietText}
          </p>
          <Link href={appHref(primaryApp, slug)} className="pp-btn hub-tool__open">
            {primaryApp.openLabel ?? `Open the ${primaryApp.label}`}
          </Link>
        </section>
      )}

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

      <nav aria-label="Team destinations"><ul className="rim-destination-list">
        {conversationsEnabled && <li><Link href={`/account/hub/${slug}/conversations`}><span>Conversations<small>Read and join team discussions</small></span><span aria-hidden="true">→</span></Link></li>}
        {filesEnabled && <li><Link href={`/account/hub/${slug}/files`}><span>Files<small>Find documents and shared resources</small></span><span aria-hidden="true">→</span></Link></li>}
        <li><Link href={`/account/hub/${slug}/members`}><span>Members<small>Find the people on your team</small></span><span aria-hidden="true">→</span></Link></li>
        {otherApps.map((app) => (
          <li key={app.key}>
            <Link href={appHref(app, slug)}>
              <span>
                {app.label}
                <small>{app.role === "link" ? "A link this team uses" : `Open this team’s ${app.label}`}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul></nav>
    </div>
  );
}
