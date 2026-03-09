"use client";

import { useState, KeyboardEvent } from "react";
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
  preferredName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  memberStatus: string;
  firstVisitDate: string | null;
  adminNotes: string | null;
  tags: string[];
  roles: string[];
  archivedAt: string | null;
  sanityInvitedAt: string | null;
  createdAt: string;
  registrations: MemberRegistration[];
  courseAccess: CourseAccessGrant[];
}

const ALL_ROLES = ["HOST", "REGISTRAR", "ADMIN"] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  HOST: "Google Meet host team — access to Host Area with session room assignments",
  REGISTRAR: "View and manage registrations, member profiles, and Sanity Studio",
  ADMIN: "Full access — members, registrations, and all volunteer areas",
};

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  WAITLISTED: "Waitlisted",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

const MEMBER_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "VISITOR", label: "Visitor" },
  { value: "STUDENT", label: "Student" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

type DangerAction = "archive" | "restore" | "delete" | null;

export default function MemberDetail({ member, isAdmin }: { member: Member; isAdmin: boolean }) {
  const router = useRouter();

  // Profile fields
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [preferredName, setPreferredName] = useState(member.preferredName ?? "");

  // Contact fields
  const [phone, setPhone] = useState(member.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(member.addressLine1 ?? "");
  const [addressCity, setAddressCity] = useState(member.addressCity ?? "");
  const [addressState, setAddressState] = useState(member.addressState ?? "");
  const [addressZip, setAddressZip] = useState(member.addressZip ?? "");

  // Email
  const [email, setEmail] = useState(member.email);
  const [originalEmail] = useState(member.email);
  const emailChanged = email.trim() !== originalEmail;
  const [emailError, setEmailError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  // Status & dates
  const [memberStatus, setMemberStatus] = useState(member.memberStatus);
  const [firstVisitDate, setFirstVisitDate] = useState(
    member.firstVisitDate ? member.firstVisitDate.slice(0, 10) : ""
  );

  // Admin-only fields
  const [adminNotes, setAdminNotes] = useState(member.adminNotes ?? "");

  // Tags
  const [tags, setTags] = useState<string[]>(member.tags);
  const [tagInput, setTagInput] = useState("");

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
    setSaved(false);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
      setSaved(false);
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
    setSaved(false);
  };

  // Roles + save state
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

  // Sanity Studio invite
  const [sanityInvitedAt, setSanityInvitedAt] = useState<string | null>(member.sanityInvitedAt);
  const [sanityStatus, setSanityStatus] = useState<"idle" | "loading" | "error">("idle");
  const [sanityError, setSanityError] = useState("");
  const [confirmingInvite, setConfirmingInvite] = useState(false);
  const [savedRoles, setSavedRoles] = useState<string[]>(member.roles);

  const handleSanityInvite = async () => {
    setSanityStatus("loading");
    setSanityError("");
    setConfirmingInvite(false);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/sanity-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.sanityInvitedAt) {
          setSanityInvitedAt(data.sanityInvitedAt);
        } else {
          throw new Error(data.error ?? "Invite failed");
        }
      } else {
        setSanityInvitedAt(data.sanityInvitedAt);
      }
      setSanityStatus("idle");
    } catch (err) {
      setSanityError(err instanceof Error ? err.message : "Invite failed");
      setSanityStatus("error");
    }
  };

  const toggleRole = (role: string) => {
    setRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
    setSaved(false);
  };

  const handleEmailBlur = async () => {
    const trimmed = email.trim();
    if (!trimmed || trimmed === originalEmail) { setEmailError(""); return; }
    setCheckingEmail(true);
    setEmailError("");
    try {
      const res = await fetch(
        `/api/admin/members/check-email?email=${encodeURIComponent(trimmed)}&excludeId=${member.id}`
      );
      const data = await res.json();
      if (!data.available) setEmailError(data.error ?? "Email not available.");
    } catch { /* non-fatal */ } finally {
      setCheckingEmail(false);
    }
  };

  const handleSave = async (bypassEmailConfirm = false) => {
    if (emailError) return;
    if (emailChanged && !bypassEmailConfirm) { setShowEmailConfirm(true); return; }
    setSaving(true);
    setSaved(false);
    setError("");
    setShowEmailConfirm(false);
    try {
      const body: Record<string, unknown> = {
        firstName, lastName, preferredName: preferredName || null,
        phone: phone || null,
        addressLine1: addressLine1 || null,
        addressCity: addressCity || null,
        addressState: addressState || null,
        addressZip: addressZip || null,
        memberStatus,
        firstVisitDate: firstVisitDate || null,
        tags,
        roles,
      };
      if (emailChanged) body.email = email.trim();
      if (isAdmin) body.adminNotes = adminNotes || null;

      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setSavedRoles(roles);
      if (data.sanityRevoked) setSanityInvitedAt(null);

      // Reflect status change in archived state
      if (memberStatus === "INACTIVE") {
        setIsArchived(true);
        setArchivedAt(new Date().toISOString());
      } else if (isArchived && memberStatus !== "INACTIVE") {
        setIsArchived(false);
        setArchivedAt(null);
      }

      if (emailChanged) router.refresh();
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
    month: "long", day: "numeric", year: "numeric",
  });

  const regDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email;

  const markDirty = () => setSaved(false);

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
        <p className="adm-header__meta">{email} · Joined {joinedDate}</p>
      </header>

      {/* Archived banner */}
      {isArchived && archivedAt && (
        <div className="adm-archived-banner">
          This member was archived on{" "}
          {new Date(archivedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
          They cannot log in, but their registration history is fully preserved.
        </div>
      )}

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Profile</h2>
        <div className="adm-form">
          <div className="adm-form__row">
            <div className="adm-form__field">
              <label className="adm-form__label">First name</label>
              <input
                type="text" className="adm-form__input" value={firstName}
                onChange={(e) => { setFirstName(e.target.value); markDirty(); }}
              />
            </div>
            <div className="adm-form__field">
              <label className="adm-form__label">Last name</label>
              <input
                type="text" className="adm-form__input" value={lastName}
                onChange={(e) => { setLastName(e.target.value); markDirty(); }}
              />
            </div>
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">Preferred name / nickname</label>
            <input
              type="text" className="adm-form__input" value={preferredName}
              placeholder="Leave blank if same as first name"
              onChange={(e) => { setPreferredName(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">Email (login address)</label>
            <input
              type="email"
              className={`adm-form__input${emailError ? " adm-form__input--error" : ""}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); markDirty(); setShowEmailConfirm(false); setEmailError(""); }}
              onBlur={handleEmailBlur}
            />
            {checkingEmail && <p className="adm-form__email-checking">Checking…</p>}
            {emailError && <p className="adm-form__email-error">{emailError}</p>}
            {emailChanged && !emailError && !checkingEmail && !showEmailConfirm && (
              <p className="adm-form__email-warning">
                ⚠️ Changing this email updates their login address. They will be signed out immediately
                and must use the new address for all future sign-ins.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Contact</h2>
        <div className="adm-form">
          <div className="adm-form__field">
            <label className="adm-form__label">Phone</label>
            <input
              type="text" className="adm-form__input" value={phone}
              onChange={(e) => { setPhone(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">Street address</label>
            <input
              type="text" className="adm-form__input" value={addressLine1}
              placeholder="123 Main St"
              onChange={(e) => { setAddressLine1(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm-form__row adm-form__row--3col">
            <div className="adm-form__field adm-form__field--city">
              <label className="adm-form__label">City</label>
              <input
                type="text" className="adm-form__input" value={addressCity}
                onChange={(e) => { setAddressCity(e.target.value); markDirty(); }}
              />
            </div>
            <div className="adm-form__field adm-form__field--state">
              <label className="adm-form__label">State</label>
              <input
                type="text" className="adm-form__input" value={addressState}
                maxLength={2} placeholder="WI"
                onChange={(e) => { setAddressState(e.target.value.toUpperCase()); markDirty(); }}
              />
            </div>
            <div className="adm-form__field adm-form__field--zip">
              <label className="adm-form__label">Zip</label>
              <input
                type="text" className="adm-form__input" value={addressZip}
                placeholder="53045"
                onChange={(e) => { setAddressZip(e.target.value); markDirty(); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Status ───────────────────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Status</h2>
        <div className="adm-form">
          <div className="adm-form__row">
            <div className="adm-form__field">
              <label className="adm-form__label">Member status</label>
              <select
                className="adm-form__select"
                value={memberStatus}
                onChange={(e) => { setMemberStatus(e.target.value); markDirty(); }}
              >
                {MEMBER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {memberStatus === "INACTIVE" && (
                <p className="adm-form__hint adm-form__hint--warn">
                  Inactive members cannot log in. Saving will sign them out immediately.
                </p>
              )}
            </div>
            <div className="adm-form__field">
              <label className="adm-form__label">First visit date</label>
              <input
                type="date" className="adm-form__input" value={firstVisitDate}
                onChange={(e) => { setFirstVisitDate(e.target.value); markDirty(); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Tags ─────────────────────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Tags</h2>
        <p className="adm-section__hint">
          Free-form labels for filtering and searching. Press Enter or comma to add a tag.
        </p>
        <div className="adm-tags">
          {tags.map((tag) => (
            <span key={tag} className="adm-tag">
              {tag}
              <button
                className="adm-tag__remove"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="adm-tags__input"
            placeholder="Add a tag…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
          />
        </div>
      </section>

      {/* ── Admin Notes ──────────────────────────────────────────────────────── */}
      {isAdmin && (
        <section className="adm-section">
          <h2 className="adm-section__title">Admin Notes</h2>
          <p className="adm-section__hint">Private — not visible to the member.</p>
          <textarea
            className="adm-form__textarea"
            rows={4}
            value={adminNotes}
            placeholder="Internal notes about this member…"
            onChange={(e) => { setAdminNotes(e.target.value); markDirty(); }}
          />
        </section>
      )}

      {/* ── Roles & Permissions ──────────────────────────────────────────────── */}
      {isAdmin && (
        <section className="adm-section">
          <h2 className="adm-section__title">Roles &amp; Permissions</h2>
          <p className="adm-section__hint">
            When a role is assigned, the member&rsquo;s dashboard will show a link to that volunteer area.
          </p>
          <div className="adm-roles">
            {ALL_ROLES.map((role) => (
              <label key={role} className="adm-role">
                <input
                  type="checkbox" className="adm-role__checkbox"
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
      )}

      {/* ── Sanity Studio Invite ─────────────────────────────────────────────── */}
      {isAdmin && savedRoles.includes("REGISTRAR") && (
        <div className="adm-sanity">
          <p className="adm-sanity__label">Sanity Studio Access</p>
          {sanityInvitedAt ? (
            <p className="adm-sanity__status">
              ✓ Invited on{" "}
              {new Date(sanityInvitedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          ) : confirmingInvite ? (
            <div className="adm-sanity__confirm">
              <p className="adm-sanity__confirm-msg">
                This will send an email invitation from Sanity to <strong>{member.email}</strong>.
                They will receive Editor access and can edit site content in Sanity Studio.
              </p>
              {sanityError && <p className="adm-sanity__error">{sanityError}</p>}
              <div className="adm-sanity__confirm-actions">
                <button className="adm-sanity__btn" onClick={handleSanityInvite} disabled={sanityStatus === "loading"}>
                  {sanityStatus === "loading" ? "Sending…" : "Yes, send invite"}
                </button>
                <button className="adm-btn--neutral" onClick={() => { setConfirmingInvite(false); setSanityError(""); }} disabled={sanityStatus === "loading"}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="adm-sanity__hint">Send this member an invitation to Sanity Studio as an Editor.</p>
              {sanityError && <p className="adm-sanity__error">{sanityError}</p>}
              <button className="adm-sanity__btn" onClick={() => setConfirmingInvite(true)}>
                Invite to Sanity Studio
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      <div className="adm-save">
        {error && <p className="adm-save__error">{error}</p>}
        {saved && <p className="adm-save__success">Saved ✓</p>}
        {isAdmin && savedRoles.includes("REGISTRAR") && !roles.includes("REGISTRAR") && !!sanityInvitedAt && (
          <p className="adm-save__warning">
            ⚠ Saving will also revoke this member&rsquo;s Sanity Studio access.
          </p>
        )}
        {showEmailConfirm ? (
          <div className="adm-email-confirm">
            <p className="adm-email-confirm__text">
              You are changing the login email from{" "}
              <strong>{originalEmail}</strong> to <strong>{email.trim()}</strong>.
              This member will be signed out immediately and must use the new address to sign in. Are you sure?
            </p>
            <div className="adm-email-confirm__actions">
              <button className="adm-save__btn" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? "Saving…" : "Yes, change email"}
              </button>
              <button className="adm-btn--cancel" onClick={() => { setShowEmailConfirm(false); setEmail(originalEmail); }} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="adm-save__btn"
            onClick={() => handleSave()}
            disabled={saving || !!emailError || checkingEmail}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      {/* ── Course Access ────────────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Course Access</h2>
        <CourseAccessSection
          memberId={member.id}
          memberRegistrations={member.registrations.map((r) => ({ programSlug: r.programSlug, status: r.status }))}
          initialGrants={member.courseAccess}
        />
      </section>

      {/* ── Registration History ─────────────────────────────────────────────── */}
      <section className="adm-section">
        <h2 className="adm-section__title">Registration History</h2>
        {member.registrations.length === 0 ? (
          <p className="adm-empty">No registrations yet.</p>
        ) : (
          <div className="adm-reg-list">
            {member.registrations.map((r) => (
              <div key={r.id} className="adm-reg">
                <div className="adm-reg__main">
                  <Link href={`/account/registrar/${r.programSlug}`} className="adm-reg__title">
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

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      {isAdmin && (
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
                {confirmAction === "restore" && <>Restore this member? They will be able to log in again.</>}
                {confirmAction === "delete" && <>Permanently delete this member? This cannot be undone.</>}
              </p>
              <div className="adm-danger-confirm__actions">
                <button
                  className={confirmAction === "delete" ? "adm-btn--danger" : "adm-btn--restore"}
                  onClick={() => handleDangerAction(confirmAction)}
                  disabled={dangerBusy}
                >
                  {dangerBusy ? "Working…" : `Confirm ${confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)}`}
                </button>
                <button className="adm-btn--neutral" onClick={() => { setConfirmAction(null); setDangerError(""); }} disabled={dangerBusy}>
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
      )}
    </>
  );
}
