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
 * Sub-step 1: role detection + skeleton shells only. Content arrives in
 * subsequent sub-steps.
 *
 * CSS prefix: hub-home- (shared) + hub-home-coord- / hub-home-host- variants.
 */

import { useState } from "react";

interface Props {
  slug: string;
  hubName: string;
  viewerRole: "coordinator" | "host";
  canToggle: boolean;
}

export default function HostHubHomeClient({
  slug,
  hubName,
  viewerRole,
  canToggle,
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
        <CoordinatorView slug={slug} hubName={hubName} />
      ) : (
        <HostView slug={slug} hubName={hubName} />
      )}
    </div>
  );
}

/* ─────────────────────────  Coordinator shell  ───────────────────────── */

function CoordinatorView({ slug, hubName }: { slug: string; hubName: string }) {
  return (
    <div className="hub-home-coord">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Coordinator view</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Needs attention</div>
        <div className="hub-home-coord__placeholder">
          Attention items will render here (sub-step 2).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Team directory</div>
        <div className="hub-home-coord__placeholder">
          Coordinator-authored prose (sub-step 2).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Quick links</div>
        <div className="hub-home-coord__placeholder">
          Quick links (sub-step 2).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Coordinator notes</div>
        <div className="hub-home-coord__placeholder">
          Coordinator notes area (sub-step 2).
        </div>
      </section>

      <div className="hub-home__debug">slug: {slug} · shell: coordinator</div>
    </div>
  );
}

/* ─────────────────────────  Host shell  ───────────────────────── */

function HostView({ slug, hubName }: { slug: string; hubName: string }) {
  return (
    <div className="hub-home-host">
      <header className="hub-home__header">
        <div className="hub-home__greeting">Welcome</div>
        <h2 className="hub-home__state">{hubName}</h2>
      </header>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Welcome</div>
        <div className="hub-home-host__placeholder">
          Host welcome content (sub-step 3).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Pinned</div>
        <div className="hub-home-host__placeholder">
          Pinned threads (sub-step 3).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Your team</div>
        <div className="hub-home-host__placeholder">
          Team roster with photos + bios (sub-step 3).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">If something goes wrong</div>
        <div className="hub-home-host__placeholder">
          Troubleshooting guidance (sub-step 3).
        </div>
      </section>

      <section className="hub-home__section">
        <div className="hub-home__section-label">Quick links</div>
        <div className="hub-home-host__placeholder">
          Host-relevant quick links (sub-step 3).
        </div>
      </section>

      <div className="hub-home__debug">slug: {slug} · shell: host</div>
    </div>
  );
}
