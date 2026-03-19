"use client";

import { useState } from "react";

const ROLE_GROUPS = [
  {
    label: "System Access",
    roles: ["ADMIN", "REGISTRAR", "TEACHER", "SUPPORT"],
  },
  {
    label: "Volunteer Teams",
    roles: [
      "HOST", "HOST_MANAGER", "VOLUNTEER_COORDINATOR", "NEWSLETTER",
      "GREETER", "AV_TEAM", "HOUSEKEEPING", "PLANT_CARE",
      "SANGHA_CARE", "KM_SUPPORT", "SILENT_MEDITATION",
    ],
  },
  {
    label: "Governance",
    roles: ["BOARD", "TEACHER_COUNCIL"],
  },
];

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
      <h2 className="adm2-section__title">Roles &amp; Permissions</h2>
      <p className="adm2-section__hint">
        When a role is assigned, the member&rsquo;s dashboard will show a link to that volunteer area.
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
                  <span className="adm2-role-item__name">{role}</span>
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
