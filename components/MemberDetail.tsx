"use client";

import { useState } from "react";
import Link from "next/link";

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

export default function MemberDetail({ member }: { member: Member }) {
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [roles, setRoles] = useState<string[]>(member.roles);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Course access state
  const [grants, setGrants] = useState<CourseAccessGrant[]>(member.courseAccess);
  const [newCourseSlug, setNewCourseSlug] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState("");

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

  const handleGrantAccess = async () => {
    const slug = newCourseSlug.trim();
    if (!slug) return;
    setGrantLoading(true);
    setGrantError("");
    try {
      const res = await fetch(`/api/admin/members/${member.id}/course-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to grant access");
      setGrants((prev) => {
        // Upsert locally
        const filtered = prev.filter((g) => g.courseSlug !== data.courseSlug);
        return [...filtered, { id: data.id, courseSlug: data.courseSlug, createdAt: data.createdAt }];
      });
      setNewCourseSlug("");
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevokeAccess = async (courseSlug: string) => {
    setGrantError("");
    try {
      const res = await fetch(
        `/api/admin/members/${member.id}/course-access?courseSlug=${encodeURIComponent(courseSlug)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke");
      }
      setGrants((prev) => prev.filter((g) => g.courseSlug !== courseSlug));
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Failed");
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
        <h1 className="adm-header__title">{displayName}</h1>
        <p className="adm-header__meta">{member.email} · Joined {joinedDate}</p>
      </header>

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
          When a role is assigned, the member's dashboard will show a link to that staff area.
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

      {/* Course access (manual grants) */}
      <section className="adm-section">
        <h2 className="adm-section__title">Course Access</h2>
        <p className="adm-section__hint">
          Members automatically get access to courses linked to programs they&rsquo;re registered for.
          Use this to manually grant access to a specific course.
        </p>

        {grantError && <p className="adm-save__error">{grantError}</p>}

        {grants.length > 0 && (
          <div className="adm-course-grants">
            {grants.map((g) => (
              <div key={g.id} className="adm-course-grant">
                <span className="adm-course-grant__slug">{g.courseSlug}</span>
                <button
                  className="adm-course-grant__revoke"
                  onClick={() => handleRevokeAccess(g.courseSlug)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {grants.length === 0 && (
          <p className="adm-empty">No manual course access grants.</p>
        )}

        <div className="adm-course-grant-form">
          <input
            type="text"
            className="adm-form__input"
            placeholder="course-slug"
            value={newCourseSlug}
            onChange={(e) => setNewCourseSlug(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleGrantAccess(); }}
          />
          <button
            className="adm-import__submit"
            onClick={handleGrantAccess}
            disabled={grantLoading || !newCourseSlug.trim()}
          >
            {grantLoading ? "Granting…" : "Grant Access"}
          </button>
        </div>
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
    </>
  );
}
