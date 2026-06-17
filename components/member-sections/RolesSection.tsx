"use client";

import { useState } from "react";

const ROLE_GROUPS = [
  {
    label: "Access & tools",
    roles: ["ADMIN", "REGISTRAR", "TEACHER", "HOST_MANAGER"],
  },
  {
    label: "Sangha-wide authority",
    roles: ["GUIDING_TEACHER"],
  },
];

// Display labels — the raw enum value (e.g. HOST_MANAGER) isn't shown directly.
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REGISTRAR: "Registrar",
  TEACHER: "Teacher",
  HOST_MANAGER: "Scheduling manager",
  GUIDING_TEACHER: "Guiding teacher",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN:          "Full access — members, registrations, and all volunteer areas",
  REGISTRAR:      "Member registry + Program Manager tool (also joins the Registrar team)",
  TEACHER:        "Course Manager tool (also joins the Courses team)",
  HOST_MANAGER:   "Manage rotations and coverage across every team’s schedule",
  GUIDING_TEACHER:"Dharma authority — can enter and moderate every hub across the sangha. Does NOT include technical / configuration admin.",
};

interface Props {
  memberId: string;
  initialRoles: string[];
}

export default function RolesSection({ memberId, initialRoles }: Props) {
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const toggleRole = (role: string) => {
    setRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="adm2-section">
      <h2 className="adm2-section__title">Roles &amp; access</h2>
      <p className="adm2-section__hint">
        These grant system-wide access and tools. Which teams a person is on — and who coordinates
        them — is set in Hub memberships below.
      </p>
      {ROLE_GROUPS.map((group) => (
        <div key={group.label} className="adm2-roles-group">
          <p className="adm2-roles-group__label">{group.label}</p>
          <div className="adm2-roles-grid">
            {group.roles.map((role) => (
              <label
                key={role}
                className={`adm2-role-item${roles.includes(role) ? " adm2-role-item--active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <div className="adm2-role-item__text">
                  <span className="adm2-role-item__name">{ROLE_LABELS[role] ?? role}</span>
                  <span className="adm2-role-item__desc">{ROLE_DESCRIPTIONS[role]}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="adm2-save">
        {error && <p className="adm2-save__error">{error}</p>}
        <button className="adm2-save__btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save roles"}
        </button>
        {saved && <span className="adm2-save__success">Saved ✓</span>}
      </div>
    </section>
  );
}
