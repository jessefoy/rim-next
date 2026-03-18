"use client";

/**
 * HubAccessSection — grant and revoke per-person hub access (UserHubAccess).
 * Used in /admin/members/[id] below the Roles & Permissions section.
 * ADMIN only.
 */

import { useState } from "react";

interface HubAccessRecord {
  hubSlug: string;
  grantedAt: string;
}

interface Props {
  memberId: string;
  memberName: string;
  initialAccess: HubAccessRecord[];
}

// Hardcoded hub list — dynamic registry to be built in a future session
const KNOWN_HUBS: { slug: string; label: string }[] = [
  { slug: "courses",   label: "Course Hub" },
  { slug: "host-team", label: "Host Team Hub" },
  { slug: "registrar", label: "Registrar Hub" },
  { slug: "support",   label: "Support Inbox" },
];

function hubLabel(slug: string): string {
  return KNOWN_HUBS.find((h) => h.slug === slug)?.label ?? slug;
}

export default function HubAccessSection({ memberId, memberName, initialAccess }: Props) {
  const [access, setAccess] = useState<HubAccessRecord[]>(initialAccess);
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [granting, setGranting] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const grantedSlugs = new Set(access.map((a) => a.hubSlug));
  const availableToGrant = KNOWN_HUBS.filter((h) => !grantedSlugs.has(h.slug));

  async function handleGrant() {
    if (!selectedHub) return;
    setGranting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/hub-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubSlug: selectedHub }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Grant failed");
      setAccess((prev) => [...prev, { hubSlug: data.hubSlug, grantedAt: data.grantedAt }]);
      setSelectedHub("");
      setMessage({ text: `Access to ${hubLabel(data.hubSlug)} granted.`, type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Grant failed", type: "error" });
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(hubSlug: string) {
    setRevoking(hubSlug);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/hub-access/${hubSlug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      setAccess((prev) => prev.filter((a) => a.hubSlug !== hubSlug));
      setMessage({ text: `Access to ${hubLabel(hubSlug)} revoked.`, type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Revoke failed", type: "error" });
    } finally {
      setRevoking(null);
      setConfirmRevoke(null);
    }
  }

  return (
    <section className="adm-section">
      <h2 className="adm-section__title">Hub Access</h2>
      <p className="adm-section__hint">
        Person-level access grants — independent of role. Controls which hub workspaces this member can enter.
      </p>

      {message && (
        <p className={`adm-hub-access__message adm-hub-access__message--${message.type}`}>
          {message.text}
        </p>
      )}

      {/* Current access list */}
      {access.length === 0 ? (
        <p className="adm-hub-access__empty">No hub access grants.</p>
      ) : (
        <ul className="adm-hub-access__list">
          {access.map((record) => (
            <li key={record.hubSlug} className="adm-hub-access__item">
              <span className="adm-hub-access__name">{hubLabel(record.hubSlug)}</span>
              <span className="adm-hub-access__since">
                since {new Date(record.grantedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              {confirmRevoke === record.hubSlug ? (
                <span className="adm-hub-access__confirm">
                  Remove {memberName}&rsquo;s access to {hubLabel(record.hubSlug)}?{" "}
                  <button
                    className="adm-btn--danger adm-btn--sm"
                    onClick={() => handleRevoke(record.hubSlug)}
                    disabled={revoking === record.hubSlug}
                  >
                    {revoking === record.hubSlug ? "Removing…" : "Yes, remove"}
                  </button>{" "}
                  <button
                    className="adm-btn--neutral adm-btn--sm"
                    onClick={() => setConfirmRevoke(null)}
                    disabled={revoking === record.hubSlug}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="adm-btn--neutral adm-btn--sm"
                  onClick={() => setConfirmRevoke(record.hubSlug)}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Grant access */}
      {availableToGrant.length > 0 && (
        <div className="adm-hub-access__grant">
          <select
            className="adm-form__select adm-hub-access__select"
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
          >
            <option value="">Select a hub…</option>
            {availableToGrant.map((h) => (
              <option key={h.slug} value={h.slug}>{h.label}</option>
            ))}
          </select>
          <button
            className="adm-btn--primary adm-btn--sm"
            onClick={handleGrant}
            disabled={!selectedHub || granting}
          >
            {granting ? "Granting…" : "Grant Access"}
          </button>
        </div>
      )}

      {availableToGrant.length === 0 && (
        <p className="adm-hub-access__empty" style={{ marginTop: 12 }}>
          This member has access to all known hubs.
        </p>
      )}
    </section>
  );
}
