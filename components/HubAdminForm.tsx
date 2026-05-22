"use client";

/**
 * HubAdminForm — create/edit form for admin hub management.
 * Used by /admin/hubs/new and /admin/hubs/[slug]/edit.
 * CSS prefix: adm-hubs-
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import SlugField from "@/components/SlugField";
import dynamic from "next/dynamic";
const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ height: 120 }} /> },
);
import Link from "next/link";
import { TOOL_REGISTRY, getToolBySlug } from "@/lib/toolRegistry";

interface AppLink {
  toolSlug: string | null;
  label: string;
  href: string;
  isEnabled: boolean;
}

interface CoordinatorInfo {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface HubData {
  name: string;
  slug: string;
  description: string;
  type: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
  status: "ACTIVE" | "ARCHIVED";
  /** Session 128 — when true, an active HostAssignment from this hub
   *  confers Teacher capability (bell-friendly audio + Teacher pill) on
   *  the assigned leader. Used by peer-led hubs where the act of claiming
   *  a session IS the teacher role for that session. */
  assignmentGrantsTeacher: boolean;
  /** Hub-level fallback for the Teacher pill text. Used when
   *  assignmentGrantsTeacher is true and the program doesn't override.
   *  Pill hierarchy: program.teacherLabel ?? hub.teacherLabel ?? "Teacher". */
  teacherLabel: string | null;
  appLinks: AppLink[];
  coordinators: CoordinatorInfo[];
  welcomeHeadline: string;
  welcomeBody: any;
  homeContent: any;
}

interface Props {
  isEditing: boolean;
  initialData?: HubData;
  hubSlug?: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function HubAdminForm({ isEditing, initialData, hubSlug }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState<HubData["type"]>(initialData?.type ?? "OPERATIONAL");
  const [status, setStatus] = useState<HubData["status"]>(initialData?.status ?? "ACTIVE");
  const [assignmentGrantsTeacher, setAssignmentGrantsTeacher] = useState<boolean>(
    initialData?.assignmentGrantsTeacher ?? false,
  );
  const [teacherLabel, setTeacherLabel] = useState<string>(initialData?.teacherLabel ?? "");
  const [appLinks, setAppLinks] = useState<AppLink[]>(initialData?.appLinks ?? []);
  const [welcomeHeadline, setWelcomeHeadline] = useState(initialData?.welcomeHeadline ?? "");
  const [welcomeBody, setWelcomeBody] = useState<string>(
    typeof initialData?.welcomeBody === "string" ? initialData.welcomeBody : "",
  );
  const [homeContent, setHomeContent] = useState<string>(
    typeof initialData?.homeContent === "string" ? initialData.homeContent : "",
  );
  const coordinators = initialData?.coordinators ?? [];

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing && !slugTouched) {
      setSlug(slugify(val));
    }
  }

  const usedToolSlugs = appLinks.map((l) => l.toolSlug).filter(Boolean) as string[];
  const availableTools = TOOL_REGISTRY.filter((t) => !usedToolSlugs.includes(t.slug));

  function addToolLink(toolSlug: string) {
    const tool = getToolBySlug(toolSlug);
    if (!tool) return;
    setAppLinks([...appLinks, { toolSlug: tool.slug, label: tool.label, href: tool.path, isEnabled: true }]);
  }

  function addCustomLink() {
    setAppLinks([...appLinks, { toolSlug: null, label: "", href: "", isEnabled: true }]);
  }

  function updateAppLink(index: number, field: keyof AppLink, value: string | boolean) {
    setAppLinks(appLinks.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function removeAppLink(index: number) {
    setAppLinks(appLinks.filter((_, i) => i !== index));
  }

  function moveAppLink(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= appLinks.length) return;
    const next = [...appLinks];
    [next[index], next[target]] = [next[target], next[index]];
    setAppLinks(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name,
      slug,
      description,
      type,
      status,
      assignmentGrantsTeacher,
      teacherLabel: teacherLabel.trim() || null,
      appLinks: appLinks.filter((l) => l.label && (l.toolSlug || l.href)),
      welcomeHeadline: welcomeHeadline || null,
      welcomeBody: welcomeBody,
      homeContent: homeContent,
    };

    try {
      const url = isEditing ? `/api/admin/hubs/${hubSlug}` : "/api/admin/hubs";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save hub.");
      }

      if (isEditing) {
        setSuccess("Hub updated.");
        // If slug changed, redirect to new edit URL
        if (slug !== hubSlug) {
          router.replace(`/admin/hubs/${slug}/edit`);
        }
      } else {
        router.push("/admin/hubs?created=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="adm-hubs-form" onSubmit={handleSubmit}>
      {error && <div className="adm-hubs-error">{error}</div>}
      {success && <div className="adm-hubs-success">{success}</div>}

      {/* Name */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Hub Name *</label>
        <input
          type="text"
          className="adm-hubs-input"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
        />
      </div>

      {/* Slug */}
      <div className="adm-hubs-field">
        <SlugField
          value={slug}
          onChange={(val) => {
            setSlug(val);
            setSlugTouched(true);
          }}
          isEditing={isEditing}
          warnText="Changing the slug will break existing hub links and bookmarks."
          hintText={`/account/hub/${slug}`}
        />
      </div>

      {/* Description */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Description</label>
        <textarea
          className="adm-hubs-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Short description of this hub's purpose."
        />
      </div>

      {/* Type */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Type</label>
        <select
          className="adm-hubs-select"
          value={type}
          onChange={(e) => setType(e.target.value as HubData["type"])}
        >
          <option value="OPERATIONAL">Operational</option>
          <option value="GOVERNANCE">Governance</option>
          <option value="COMMUNITY_GROUP">Community Group</option>
        </select>
      </div>

      {/* Status */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Status</label>
        <select
          className="adm-hubs-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as HubData["status"])}
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Assignment confers Teacher capability — session 128 */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">
          <input
            type="checkbox"
            checked={assignmentGrantsTeacher}
            onChange={(e) => {
              const next = e.target.checked;
              setAssignmentGrantsTeacher(next);
              // Unchecking clears any typed label so a stale value can't
              // ride along on submit. The conditional input renders this
              // moot for UI purposes, but the state shouldn't carry it.
              if (!next) setTeacherLabel("");
            }}
            style={{ marginRight: 8 }}
          />
          Hub assignments grant Teacher capability
        </label>
        <p className="adm-hubs-help">
          When enabled, anyone assigned to lead a session in this hub
          automatically gets the Teacher pill and bell-friendly audio in
          the session room — without needing to be a ProgramTeacher of the
          program. Use this for peer-led offerings (silent meditation, Recovery
          Dharma, etc.) where the leader rotates each week. Leave off for
          host-team-style hubs where teachers are attributed per-program.
        </p>
      </div>

      {/* Teacher pill label — only meaningful when assignmentGrantsTeacher is true */}
      {assignmentGrantsTeacher && (
        <div className="adm-hubs-field">
          <label className="adm-hubs-label">Default pill label</label>
          <input
            type="text"
            className="adm-hubs-input"
            value={teacherLabel}
            onChange={(e) => setTeacherLabel(e.target.value)}
            placeholder="Guide"
            maxLength={20}
          />
          <p className="adm-hubs-hint">
            What the role pill reads on a leader&rsquo;s tile in the session
            room when they&rsquo;ve been assigned via this hub. Common choices:
            &ldquo;Guide&rdquo; for silent meditation, &ldquo;Facilitator&rdquo;
            for Recovery Dharma, &ldquo;Instructor&rdquo; for skills-based
            offerings. Per-program override on the program record takes
            priority; this is the hub-wide fallback. Leave blank to default
            to &ldquo;Teacher.&rdquo;
          </p>
        </div>
      )}

      {/* Coordinator — read only */}
      {isEditing && (
        <div className="adm-hubs-field">
          <label className="adm-hubs-label">Coordinator</label>
          {coordinators.length > 0 ? (
            <div className="adm-hubs-coordinator">
              {coordinators.map((c, i) => (
                <span key={i} className="adm-hubs-coordinator__name">
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                </span>
              ))}
              <Link href={`/account/hub/${hubSlug}/members`} className="adm-hubs-coordinator__link">
                Manage in hub Members tab
              </Link>
            </div>
          ) : (
            <div className="adm-hubs-coordinator">
              <span className="adm-hubs-coordinator__none">No coordinator assigned.</span>
              <Link href={`/account/hub/${hubSlug}/members`} className="adm-hubs-coordinator__link">
                Assign in hub Members tab
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Welcome (newcomer interstitial) */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Welcome Headline</label>
        <input
          type="text"
          className="adm-hubs-input"
          value={welcomeHeadline}
          onChange={(e) => setWelcomeHeadline(e.target.value)}
          placeholder="e.g. Welcome to the Host Team"
        />
        <span className="adm-hubs-hint">
          Shown on the newcomer welcome screen. Leave blank to skip the interstitial.
        </span>
      </div>

      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Welcome Body</label>
        <RimTiptapEditor
          value={welcomeBody}
          onChange={setWelcomeBody}
          variant="message"
          placeholder="Orientation content for new hub members..."
        />
        <span className="adm-hubs-hint">
          Orientation text shown once to new members on first visit.
        </span>
      </div>

      {/* Hub Home orientation (shown on every visit, bottom of Home) */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Hub Home Orientation</label>
        <RimTiptapEditor
          value={homeContent}
          onChange={setHomeContent}
          variant="message"
          placeholder="Optional orientation block shown at the bottom of this hub's Home..."
        />
        <span className="adm-hubs-hint">
          Long-lived context for this hub — shown beneath the activity rail on Home. Leave blank to hide.
        </span>
      </div>

      {/* Tools */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Tools</label>
        {appLinks.length === 0 && (
          <p className="adm-hubs-hint">No tools connected. Add a tool to show it in this hub&apos;s sidebar.</p>
        )}
        {appLinks.map((link, i) => {
          const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
          return (
            <div key={i} className="adm-hubs-applink">
              <div className="adm-hubs-applink__fields">
                {tool ? (
                  <>
                    <div className="adm-hubs-applink__tool-name">{tool.label}</div>
                    <div className="adm-hubs-applink__tool-desc">{tool.description}</div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      className="adm-hubs-input adm-hubs-input--half"
                      value={link.label}
                      onChange={(e) => updateAppLink(i, "label", e.target.value)}
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      className="adm-hubs-input adm-hubs-input--half"
                      value={link.href}
                      onChange={(e) => updateAppLink(i, "href", e.target.value)}
                      placeholder="URL or /path"
                    />
                  </>
                )}
              </div>
              <div className="adm-hubs-applink__actions">
                <label className="adm-hubs-applink__toggle">
                  <input
                    type="checkbox"
                    checked={link.isEnabled}
                    onChange={(e) => updateAppLink(i, "isEnabled", e.target.checked)}
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  className="adm-hubs-btn-icon"
                  onClick={() => moveAppLink(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  className="adm-hubs-btn-icon"
                  onClick={() => moveAppLink(i, 1)}
                  disabled={i === appLinks.length - 1}
                  title="Move down"
                >
                  &darr;
                </button>
                <button
                  type="button"
                  className="adm-hubs-btn-icon adm-hubs-btn-icon--danger"
                  onClick={() => removeAppLink(i)}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            </div>
          );
        })}
        <div className="adm-hubs-applink__add-row">
          {availableTools.length > 0 && (
            <select
              className="adm-hubs-select adm-hubs-select--inline"
              value=""
              onChange={(e) => {
                if (e.target.value) addToolLink(e.target.value);
              }}
            >
              <option value="">+ Add tool…</option>
              {availableTools.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="adm-hubs-btn-add" onClick={addCustomLink}>
            + Custom link
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="adm-hubs-actions">
        <button type="submit" className="adm-hubs-btn-save" disabled={saving}>
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Hub"}
        </button>
        <Link href="/admin/hubs" className="adm-hubs-btn-cancel">
          Cancel
        </Link>
      </div>
    </form>
  );
}
