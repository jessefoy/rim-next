"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CourseAccessSection from "@/components/CourseAccessSection";

interface MemberRegistration {
  id: string;
  programTitle: string;
  programSlug: string;
  status: string;
  donationStatus: string;
  createdAt: string;
}

interface CourseAccessGrant {
  id: string;
  courseSlug: string;
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roles: string[];
  archivedAt: string | null;
  createdAt: string;
  registrations: MemberRegistration[];
  courseAccess: CourseAccessGrant[];
}

const ALL_ROLES = ["ADMIN", "REGISTRAR", "TREASURER", "TEACHER", "VOLUNTEER"] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full access — members, registrations, and all staff areas",
  REGISTRAR: "View and manage program registrations",
  TREASURER: "View donation records and enter manual donations",
  TEACHER: "Teacher area (coming soon)",
  VOLUNTEER: "Volunteer area (coming soon)",
};

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  WAITLISTED: "Waitlisted",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

type DangerAction = "archive" | "restore" | "delete" | null;

export default function MemberDetail({ member }: { member: Member }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [roles, setRoles] = useState<string[]>(member.roles);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Danger zone state
  const [isArchived, setIsArchived] = useState(!!member.archivedAt);
  const [archivedAt, setArchivedAt] = useState<string | null>(member.archivedAt);
  const [confirmAction, setConfirmAction] = useState<DangerAction>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState("");

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, roles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDangerAction = async (action: DangerAction) => {
    if (!action) return;
    setDangerBusy(true);
    setDangerError("");
    try {
      if (action === "delete") {
        const res = await fetch(`/api/admin/members/${member.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Delete failed");
        router.push("/admin/members");
        return;
      }
      // archive or restore
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${action} failed`);
      if (action === "archive") {
        setIsArchived(true);
        setArchivedAt(new Date().toISOString());
        router.push("/admin/members");
      } else {
        setIsArchived(false);
        setArchivedAt(null);
      }
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDangerBusy(false);
      setConfirmAction(null);
    }
  };

  const joinedDate = new Date(member.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const regDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email;

  return (
    <>
      {/* Back link */}
      <Link href="/admin/members" className="adm-back">
        ← All members
      </Link>

      {/* Page title */}
      <header className="adm-header">
        <p className="lp-label">Admin · Members</p>
        <h1 className="adm-header__title">
          {displayName}
          {isArchived && <span className="adm-badge--archived">Archived</span>}
        </h1>
        <p className="adm-header__meta">{member.email} · Joined {joinedDate}</p>
      </header>

      {/* Archived banner */}
      {isArchived && archivedAt && (
        <div className="adm-archived-banner">
          This member was archived on {new Date(archivedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
          They cannot log in, but their registration history is fully preserved.
        </div>
      )}

      {/* Profile section */}
      <section className="adm-section">
        <h2 className="adm-section__title">Profile</h2>
        <div className="adm-form">
          <div className="adm-form__row">
            <div className="adm-form__field">
              <label className="adm-form__label">First name</label>
              <input
                type="text"
                className="adm-form__input"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setSaved(false); }}
              />
            </div>
            <div className="adm-form__field">
              <label className="adm-form__label">Last name</label>
              <input
                type="text"
                className="adm-form__input"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setSaved(false); }}
              />
            </div>
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">Phone</label>
            <input
              type="text"
              className="adm-form__input"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
            />
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">Email</label>
            <input
              type="email"
              className="adm-form__input adm-form__input--readonly"
              value={member.email}
              readOnly
            />
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section className="adm-section">
        <h2 className="adm-section__title">Roles &amp; Permissions</h2>
        <p className="adm-section__hint">
          When a role is assigned, the member&rsquo;s dashboard will show a link to that staff area.
        </p>
        <div className="adm-roles">
          {ALL_ROLES.map((role) => (
            <label key={role} className="adm-role">
              <input
                type="checkbox"
                className="adm-role__checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              <div className="adm-role__text">
                <span className="adm-role__name">{role}</span>
                <span className="adm-role__desc">{ROLE_DESCRIPTIONS[role]}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Save bar */}
      <div className="adm-save">
        {error && <p className="adm-save__error">{error}</p>}
        {saved && <p className="adm-save__success">Saved ✓</p>}
        <button className="adm-save__btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Course access */}
      <section className="adm-section">
        <h2 className="adm-section__title">Course Access</h2>
        <CourseAccessSection
          memberId={member.id}
          memberRegistrations={member.registrations.map((r) => ({
            programSlug: r.programSlug,
            status: r.status,
          }))}
          initialGrants={member.courseAccess}
        />
      </section>

      {/* Registration history */}
      <section className="adm-section">
        <h2 className="adm-section__title">Registration History</h2>
        {member.registrations.length === 0 ? (
          <p className="adm-empty">No registrations yet.</p>
        ) : (
          <div className="adm-reg-list">
            {member.registrations.map((r) => (
              <div key={r.id} className="adm-reg">
                <div className="adm-reg__main">
                  <Link
                    href={`/volunteer/programs/${r.programSlug}`}
                    className="adm-reg__title"
                  >
                    {r.programTitle}
                  </Link>
                  <span className="adm-reg__date">{regDate(r.createdAt)}</span>
                </div>
                <div className="adm-reg__badges">
                  <span className={`adm-reg__status adm-reg__status--${r.status.toLowerCase()}`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="adm-danger-zone">
        <p className="adm-danger-zone__title">Danger Zone</p>

        {dangerError && <p className="adm-save__error" style={{ marginBottom: 12 }}>{dangerError}</p>}

        {confirmAction ? (
          <div className="adm-danger-confirm">
            <p className="adm-danger-confirm__msg">
              {confirmAction === "archive" && (
                <>Archive this member? They will be logged out immediately and unable to log in.
                Their registration history will be preserved. They can self-reactivate at any time.</>
              )}
              {confirmAction === "restore" && (
                <>Restore this member? They will be able to log in again.</>
              )}
              {confirmAction === "delete" && (
                <>Permanently delete this member? This cannot be undone.</>
              )}
            </p>
            <div className="adm-danger-confirm__actions">
              <button
                className={confirmAction === "delete" ? "adm-btn--danger" : "adm-btn--restore"}
                onClick={() => handleDangerAction(confirmAction)}
                disabled={dangerBusy}
              >
                {dangerBusy ? "Working…" : `Confirm ${confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)}`}
              </button>
              <button
                className="adm-btn--neutral"
                onClick={() => { setConfirmAction(null); setDangerError(""); }}
                disabled={dangerBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="adm-danger-actions">
            {isArchived ? (
              <button className="adm-btn--restore" onClick={() => setConfirmAction("restore")}>
                Restore Member
              </button>
            ) : (
              <>
                <button className="adm-btn--danger adm-btn--outline" onClick={() => setConfirmAction("archive")}>
                  Archive Member
                </button>
                {member.registrations.length === 0 && (
                  <button className="adm-btn--danger" onClick={() => setConfirmAction("delete")}>
                    Delete Member
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
