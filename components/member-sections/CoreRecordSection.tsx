"use client";

import { useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { SerializedMember, ViewerPermissions } from "@/lib/memberSectionRegistry";

const MEMBER_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "VISITOR", label: "Visitor" },
  { value: "STUDENT", label: "Student" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

interface Props {
  member: SerializedMember;
  viewerPermissions: ViewerPermissions;
}

export default function CoreRecordSection({ member }: Props) {
  const router = useRouter();

  // Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);

  // Identity fields
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [preferredName, setPreferredName] = useState(member.preferredName ?? "");
  const [title, setTitle] = useState(member.title ?? "");

  // Email
  const [email, setEmail] = useState(member.email);
  const [originalEmail] = useState(member.email);
  const emailChanged = email.trim() !== originalEmail;
  const [emailError, setEmailError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  // Contact fields
  const [phone, setPhone] = useState(member.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(member.addressLine1 ?? "");
  const [addressCity, setAddressCity] = useState(member.addressCity ?? "");
  const [addressState, setAddressState] = useState(member.addressState ?? "");
  const [addressZip, setAddressZip] = useState(member.addressZip ?? "");

  // Status & dates
  const effectiveStatus =
    member.archivedAt && member.memberStatus !== "INACTIVE" ? "INACTIVE" : member.memberStatus;
  const [memberStatus, setMemberStatus] = useState(effectiveStatus);
  const [firstVisitDate, setFirstVisitDate] = useState(
    member.firstVisitDate ? member.firstVisitDate.slice(0, 10) : ""
  );

  // Tags
  const [tags, setTags] = useState<string[]>(member.tags);
  const [tagInput, setTagInput] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const markDirty = () => setSaved(false);

  const cancelEdit = () => {
    // Reset all state to prop values
    setFirstName(member.firstName ?? "");
    setLastName(member.lastName ?? "");
    setPreferredName(member.preferredName ?? "");
    setTitle(member.title ?? "");
    setEmail(member.email);
    setEmailError("");
    setShowEmailConfirm(false);
    setPhone(member.phone ?? "");
    setAddressLine1(member.addressLine1 ?? "");
    setAddressCity(member.addressCity ?? "");
    setAddressState(member.addressState ?? "");
    setAddressZip(member.addressZip ?? "");
    setMemberStatus(effectiveStatus);
    setFirstVisitDate(member.firstVisitDate ? member.firstVisitDate.slice(0, 10) : "");
    setTags(member.tags);
    setTagInput("");
    setError("");
    setSaved(false);
    setIsEditing(false);
  };

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
        firstName, lastName,
        preferredName: preferredName || null,
        title: title || null,
        phone: phone || null,
        addressLine1: addressLine1 || null,
        addressCity: addressCity || null,
        addressState: addressState || null,
        addressZip: addressZip || null,
        memberStatus,
        firstVisitDate: firstVisitDate || null,
        tags,
      };
      if (emailChanged) body.email = email.trim();

      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setIsEditing(false);
      if (emailChanged) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Display mode ────────────────────────────────────────────────────────────

  if (!isEditing) {
    return (
      <section className="adm2-section">
        <h2 className="adm2-section__title">
          Identity &amp; Contact
          <button className="adm2-edit-toggle" onClick={() => setIsEditing(true)}>Edit</button>
        </h2>
        <div className="adm2-display">
          <span className="adm2-display__label">Name</span>
          <span className="adm2-display__value">
            {[title, firstName, preferredName ? `"${preferredName}"` : null, lastName]
              .filter(Boolean).join(" ") || <span className="adm2-display__value--empty">Not set</span>}
          </span>
          <span className="adm2-display__label">Email</span>
          <span className="adm2-display__value">{email}</span>
          <span className="adm2-display__label">Phone</span>
          <span className="adm2-display__value">
            {phone || <span className="adm2-display__value--empty">Not set</span>}
          </span>
          <span className="adm2-display__label">Address</span>
          <span className="adm2-display__value">
            {[addressLine1, addressCity, addressState, addressZip].filter(Boolean).join(", ")
              || <span className="adm2-display__value--empty">Not set</span>}
          </span>
          <span className="adm2-display__label">Status</span>
          <span className="adm2-display__value">
            {memberStatus.charAt(0) + memberStatus.slice(1).toLowerCase()}
          </span>
          <span className="adm2-display__label">First visit</span>
          <span className="adm2-display__value">
            {firstVisitDate
              ? new Date(firstVisitDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : <span className="adm2-display__value--empty">Not recorded</span>}
          </span>
          {tags.length > 0 && (
            <>
              <span className="adm2-display__label">Tags</span>
              <span className="adm2-display__value">
                <div className="adm2-tags" style={{ paddingTop: 0 }}>
                  {tags.map((t) => (
                    <span key={t} className="adm2-tag">{t}</span>
                  ))}
                </div>
              </span>
            </>
          )}
        </div>
      </section>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <section className="adm2-section">
        <h2 className="adm2-section__title">Profile</h2>
        <div className="adm2-form">
          <div className="adm2-form__row">
            <div className="adm2-form__field">
              <label className="adm2-form__label">First name</label>
              <input
                type="text" className="adm2-form__input" value={firstName}
                onChange={(e) => { setFirstName(e.target.value); markDirty(); }}
              />
            </div>
            <div className="adm2-form__field">
              <label className="adm2-form__label">Last name</label>
              <input
                type="text" className="adm2-form__input" value={lastName}
                onChange={(e) => { setLastName(e.target.value); markDirty(); }}
              />
            </div>
          </div>
          <div className="adm2-form__field">
            <label className="adm2-form__label">Preferred name / nickname</label>
            <input
              type="text" className="adm2-form__input" value={preferredName}
              placeholder="Leave blank if same as first name"
              onChange={(e) => { setPreferredName(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm2-form__field">
            <label className="adm2-form__label">Title</label>
            <input
              type="text" className="adm2-form__input" value={title}
              placeholder="e.g. Guiding Teacher, Program Registrar"
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm2-form__field">
            <label className="adm2-form__label">Email (login address)</label>
            <input
              type="email"
              className={`adm2-form__input${emailError ? " adm2-form__input--error" : ""}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); markDirty(); setShowEmailConfirm(false); setEmailError(""); }}
              onBlur={handleEmailBlur}
            />
            {checkingEmail && <p className="adm2-form__email-checking">Checking…</p>}
            {emailError && <p className="adm2-form__email-error">{emailError}</p>}
            {emailChanged && !emailError && !checkingEmail && !showEmailConfirm && (
              <p className="adm2-form__email-warning">
                ⚠️ Changing this email updates their login address. They will be signed out immediately
                and must use the new address for all future sign-ins.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <section className="adm2-section">
        <h2 className="adm2-section__title">Contact</h2>
        <div className="adm2-form">
          <div className="adm2-form__field">
            <label className="adm2-form__label">Phone</label>
            <input
              type="text" className="adm2-form__input" value={phone}
              onChange={(e) => { setPhone(e.target.value); markDirty(); }}
            />
          </div>
          <div className="adm2-form__field">
            <label className="adm2-form__label">Street address</label>
            <input
              type="text" className="adm2-form__input" value={addressLine1}
              placeholder="123 Main St"
              onChange={(e) => { setAddressLine1(e.target.value); markDirty(); }}
            />
            {!addressLine1 && member.household?.addressLine1 && (
              <p className="adm2-form__hint">
                No individual address — household address will be used:{" "}
                <span className="hh-from-household">
                  {[member.household.addressLine1, member.household.addressCity, member.household.addressState].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
          </div>
          <div className="adm2-form__row">
            <div className="adm2-form__field">
              <label className="adm2-form__label">City</label>
              <input
                type="text" className="adm2-form__input" value={addressCity}
                onChange={(e) => { setAddressCity(e.target.value); markDirty(); }}
              />
            </div>
            <div className="adm2-form__field" style={{ maxWidth: 80 }}>
              <label className="adm2-form__label">State</label>
              <input
                type="text" className="adm2-form__input" value={addressState}
                maxLength={2} placeholder="WI"
                onChange={(e) => { setAddressState(e.target.value.toUpperCase()); markDirty(); }}
              />
            </div>
            <div className="adm2-form__field" style={{ maxWidth: 110 }}>
              <label className="adm2-form__label">Zip</label>
              <input
                type="text" className="adm2-form__input" value={addressZip}
                placeholder="53045"
                onChange={(e) => { setAddressZip(e.target.value); markDirty(); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Status ───────────────────────────────────────────────────────────── */}
      <section className="adm2-section">
        <h2 className="adm2-section__title">Status</h2>
        <div className="adm2-form">
          <div className="adm2-form__row">
            <div className="adm2-form__field">
              <label className="adm2-form__label">Member status</label>
              <select
                className="adm2-form__select"
                value={memberStatus}
                onChange={(e) => { setMemberStatus(e.target.value); markDirty(); }}
              >
                {MEMBER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {memberStatus === "INACTIVE" && (
                <p className="adm2-form__hint adm2-form__hint--warn">
                  Inactive members cannot log in. Saving will sign them out immediately.
                </p>
              )}
            </div>
            <div className="adm2-form__field">
              <label className="adm2-form__label">First visit date</label>
              <input
                type="date" className="adm2-form__input" value={firstVisitDate}
                onChange={(e) => { setFirstVisitDate(e.target.value); markDirty(); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Tags ─────────────────────────────────────────────────────────────── */}
      <section className="adm2-section">
        <h2 className="adm2-section__title">Tags</h2>
        <p className="adm2-section__hint">
          Free-form labels for filtering and searching. Press Enter or comma to add a tag.
        </p>
        <div className="adm2-tags">
          {tags.map((tag) => (
            <span key={tag} className="adm2-tag">
              {tag}
              <button
                className="adm2-tag__remove"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="adm2-tags__input"
            placeholder="Add a tag…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
          />
        </div>
      </section>

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      <div className="adm2-save">
        {error && <p className="adm2-save__error">{error}</p>}
        {saved && <span className="adm2-save__success">Saved ✓</span>}
        {showEmailConfirm ? (
          <div className="adm2-email-confirm">
            <p className="adm2-email-confirm__text">
              You are changing the login email from{" "}
              <strong>{originalEmail}</strong> to <strong>{email.trim()}</strong>.
              This member will be signed out immediately and must use the new address to sign in. Are you sure?
            </p>
            <div className="adm2-email-confirm__actions">
              <button className="adm2-save__btn" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? "Saving…" : "Yes, change email"}
              </button>
              <button className="adm2-save__cancel" onClick={() => { setShowEmailConfirm(false); setEmail(originalEmail); }} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              className="adm2-save__btn"
              onClick={() => handleSave()}
              disabled={saving || !!emailError || checkingEmail}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className="adm2-save__cancel" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </>
        )}
      </div>
    </>
  );
}
