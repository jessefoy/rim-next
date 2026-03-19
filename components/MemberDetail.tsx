"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import FormattedEditor from "@/components/FormattedEditor";
import SlugField from "@/components/SlugField";
import Link from "next/link";
import CourseAccessSection from "@/components/CourseAccessSection";
import HouseholdSection from "@/components/HouseholdSection";
import HubAccessSection from "@/components/HubAccessSection";

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
  title: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  memberStatus: string;
  firstVisitDate: string | null;
  adminNotes: any; // Tiptap JSON or null
  tags: string[];
  roles: string[];
  isTeacher: boolean;
  teacherProfile: {
    bio: string | null;
    photoUrl: string | null;
    slug: string | null;
    isPublic: boolean;
  } | null;
  archivedAt: string | null;
  createdAt: string;
  registrations: MemberRegistration[];
  courseAccess: CourseAccessGrant[];
  hubAccess: { hubSlug: string; grantedAt: string }[];
  household: {
    id: string;
    name: string | null;
    addressLine1: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    isPrimary: boolean;
    relationshipType: string;
    relationshipCustom: string | null;
    otherMembers: {
      userId: string;
      isPrimary: boolean;
      relationshipType: string;
      relationshipCustom: string | null;
      user: { id: string; firstName: string | null; lastName: string | null; email: string };
    }[];
  } | null;
}

const ALL_ROLES = [
  "HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN", "TEACHER", "SUPPORT",
  "VOLUNTEER_COORDINATOR", "NEWSLETTER", "GREETER", "AV_TEAM",
  "HOUSEKEEPING", "PLANT_CARE", "SANGHA_CARE", "KM_SUPPORT",
  "SILENT_MEDITATION", "BOARD", "TEACHER_COUNCIL",
] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  HOST:                  "Google Meet host team — access to Host Hub (schedule, sub board, threads)",
  HOST_MANAGER:          "Manages host schedule and assignments — full Hub read/write; can also be on rotation",
  REGISTRAR:             "View and manage registrations, programs, and member profiles",
  ADMIN:                 "Full access — members, registrations, and all volunteer areas",
  TEACHER:               "Course Hub access — manages courses and lessons",
  SUPPORT:               "Support Inbox — shared inbox, thread assignment, reply, internal notes",
  VOLUNTEER_COORDINATOR: "Coordinates volunteer scheduling and onboarding",
  NEWSLETTER:            "Creates and sends the community newsletter",
  GREETER:               "Welcomes newcomers and supports in-person arrivals",
  AV_TEAM:               "Manages audio/visual setup for in-person and hybrid sessions",
  HOUSEKEEPING:          "Maintains the physical space (cleaning, setup/teardown)",
  PLANT_CARE:            "Cares for the center's plants and garden",
  SANGHA_CARE:           "Reaches out to members who may need support",
  KM_SUPPORT:            "Facilitates Kalyana Mitta (spiritual friendship) groups",
  SILENT_MEDITATION:     "Supports the silent meditation program",
  BOARD:                 "Governance board member",
  TEACHER_COUNCIL:       "Teacher council member",
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

type DangerAction = "delete" | null;

export default function MemberDetail({ member, isAdmin }: { member: Member; isAdmin: boolean }) {
  const router = useRouter();

  // Profile fields
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [preferredName, setPreferredName] = useState(member.preferredName ?? "");
  const [title, setTitle] = useState(member.title ?? "");

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

  // Status & dates — if archivedAt is set but memberStatus wasn't synced (legacy records),
  // treat them as INACTIVE so the dropdown reflects reality.
  const effectiveStatus =
    member.archivedAt && member.memberStatus !== "INACTIVE" ? "INACTIVE" : member.memberStatus;
  const [memberStatus, setMemberStatus] = useState(effectiveStatus);
  const [firstVisitDate, setFirstVisitDate] = useState(
    member.firstVisitDate ? member.firstVisitDate.slice(0, 10) : ""
  );

  // Admin-only fields
  const [adminNotes, setAdminNotes] = useState<any>(member.adminNotes ?? null);

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

  // isArchived tracks whether member is currently blocked from logging in
  const [isArchived, setIsArchived] = useState(!!member.archivedAt || effectiveStatus === "INACTIVE");
  const [archivedAt, setArchivedAt] = useState<string | null>(member.archivedAt);
  const [confirmAction, setConfirmAction] = useState<DangerAction>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState("");

  const [savedRoles, setSavedRoles] = useState<string[]>(member.roles);
  const [isTeacher, setIsTeacher] = useState(member.isTeacher);

  // Teacher profile state
  const [teacherBio, setTeacherBio] = useState(member.teacherProfile?.bio ?? "");
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState(member.teacherProfile?.photoUrl ?? "");
  const [teacherSlug, setTeacherSlug] = useState(member.teacherProfile?.slug ?? "");
  const [teacherIsPublic, setTeacherIsPublic] = useState(member.teacherProfile?.isPublic ?? false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Auto-generate slug when isTeacher is first enabled and no slug exists yet
  useEffect(() => {
    if (isTeacher && !teacherSlug) {
      const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      if (generated) setTeacherSlug(generated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

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
        title: title || null,
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
      if (isAdmin) { body.adminNotes = adminNotes || null; body.isTeacher = isTeacher; }

      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setSavedRoles(roles);

      // Keep isArchived in sync with memberStatus
      if (memberStatus === "INACTIVE") {
        setIsArchived(true);
        setArchivedAt((prev) => prev ?? new Date().toISOString());
      } else {
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

  const handleSaveTeacherProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/members/${member.id}/teacher-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: teacherBio || null,
          photoUrl: teacherPhotoUrl || null,
          slug: teacherSlug || null,
          isPublic: teacherIsPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDangerAction = async (action: DangerAction) => {
    if (action !== "delete") return;
    setDangerBusy(true);
    setDangerError("");
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      router.push("/admin/members");
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : "Delete failed");
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
            <label className="adm-form__label">Title</label>
            <input
              type="text" className="adm-form__input" value={title}
              placeholder="e.g. Guiding Teacher, Program Registrar"
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
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
            {!addressLine1 && member.household?.addressLine1 && (
              <p className="adm-form__hint">
                No individual address — household address will be used:{" "}
                <span className="hh-from-household">
                  {[member.household.addressLine1, member.household.addressCity, member.household.addressState].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
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

      {/* ── Household ────────────────────────────────────────────────────────── */}
      <HouseholdSection memberId={member.id} household={member.household} />

      {/* ── Admin Notes ──────────────────────────────────────────────────────── */}
      {isAdmin && (
        <section className="adm-section">
          <h2 className="adm-section__title">Admin Notes</h2>
          <p className="adm-section__hint">Private — not visible to the member.</p>
          <FormattedEditor
            value={adminNotes}
            onChange={(v: any) => { setAdminNotes(v); markDirty(); }}
            placeholder="Internal notes about this member…"
            minHeight={160}
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

      {/* ── Is a Teacher ─────────────────────────────────────────────────────── */}
      {isAdmin && (
        <section className="adm-section">
          <h2 className="adm-section__title">Teacher Attribution</h2>
          <label className="adm-role">
            <input
              type="checkbox"
              className="adm-role__checkbox"
              checked={isTeacher}
              onChange={() => { setIsTeacher((v) => !v); setSaved(false); }}
            />
            <div className="adm-role__text">
              <span className="adm-role__name">Teacher</span>
              <span className="adm-role__desc">Can be attributed to lessons and series in the lesson editor.</span>
            </div>
          </label>
        </section>
      )}

      {/* ── Teacher Profile (visible when isTeacher) ─────────────────────────── */}
      {isAdmin && isTeacher && (
        <section className="adm-section">
          <h2 className="adm-section__title">Public Teacher Profile</h2>
          <p className="adm-section__hint">
            Optional public profile page. Set a slug to enable the public URL (e.g. /teachers/jesse-foy).
            Check &ldquo;Show on public Teachers page&rdquo; to make it discoverable.
          </p>
          <div className="adm-form">
            <label className="adm-field">
              <span className="adm-field__label">Bio</span>
              <textarea
                value={teacherBio}
                onChange={(e) => setTeacherBio(e.target.value)}
                className="adm-textarea"
                rows={4}
                placeholder="A short bio for this teacher…"
              />
            </label>
            <label className="adm-field">
              <span className="adm-field__label">Photo URL</span>
              <input
                type="text"
                value={teacherPhotoUrl}
                onChange={(e) => setTeacherPhotoUrl(e.target.value)}
                className="adm-input"
                placeholder="https://…"
              />
            </label>
            <div className="adm-field">
              <span className="adm-field__label">Slug</span>
              <SlugField
                value={teacherSlug}
                onChange={setTeacherSlug}
                isEditing={true}
                warnText="Changing the slug will break any existing links to this teacher's public page."
                hintText="Public URL: /teachers/[slug]. Leave blank to hide from the public page."
              />
            </div>
            <label className="adm-role" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                className="adm-role__checkbox"
                checked={teacherIsPublic}
                onChange={(e) => setTeacherIsPublic(e.target.checked)}
              />
              <div className="adm-role__text">
                <span className="adm-role__name">Show on public Teachers page</span>
              </div>
            </label>
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <button className="adm-save__btn" onClick={handleSaveTeacherProfile} disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save teacher profile"}
            </button>
            {profileSaved && <span style={{ color: "#3a7a5a", fontSize: 14 }}>Saved ✓</span>}
            {profileError && <span style={{ color: "#c0392b", fontSize: 14 }}>{profileError}</span>}
          </div>
        </section>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      <div className="adm-save">
        {error && <p className="adm-save__error">{error}</p>}
        {saved && <p className="adm-save__success">Saved ✓</p>}
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

      {/* ── Hub Access ───────────────────────────────────────────────────────── */}
      {isAdmin && (
        <HubAccessSection
          memberId={member.id}
          memberName={displayName}
          initialAccess={member.hubAccess}
        />
      )}

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
                  <Link href={`/account/hub/registrar/programs/${r.programSlug}`} className="adm-reg__title">
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
      {isAdmin && member.registrations.length === 0 && (
        <section className="adm-danger-zone">
          <p className="adm-danger-zone__title">Danger Zone</p>
          <p className="adm-section__hint" style={{ marginBottom: 14 }}>
            To block login access, set status to Inactive above.
            Permanent delete is only available for members with no registrations.
          </p>
          {dangerError && <p className="adm-save__error" style={{ marginBottom: 12 }}>{dangerError}</p>}
          {confirmAction === "delete" ? (
            <div className="adm-danger-confirm">
              <p className="adm-danger-confirm__msg">
                Permanently delete this member? This cannot be undone.
              </p>
              <div className="adm-danger-confirm__actions">
                <button className="adm-btn--danger" onClick={() => handleDangerAction("delete")} disabled={dangerBusy}>
                  {dangerBusy ? "Deleting…" : "Confirm Delete"}
                </button>
                <button className="adm-btn--neutral" onClick={() => { setConfirmAction(null); setDangerError(""); }} disabled={dangerBusy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="adm-btn--danger" onClick={() => setConfirmAction("delete")}>
              Delete Member
            </button>
          )}
        </section>
      )}
    </>
  );
}
