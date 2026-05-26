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
  /** True for hubs that run live sessions (host-team, peer-led-silent-
   *  meditation). Drives two things: the hub's Home view shows the
   *  host-team-style "Our offerings this month" panel, AND the hub
   *  is selectable as a primary hosting team in the Program editor.
   *  Leave off for AV / greeter / future supporting-role hubs.
   *  Note: a hub having a Scheduler app link in its sidebar is a
   *  separate concern — supporting-role hubs use the Scheduler too,
   *  they just don't run the live session. */
  hasSchedule: boolean;
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
  /** True when the admin viewing this page is already an active coordinator
   *  of this hub.  Drives whether the "Add me as coordinator" affordance
   *  appears.  Session 128 follow-up: ADMIN no longer bypasses hub content
   *  access, so an admin who creates a new hub must bootstrap themselves
   *  in via this button before they can reach /account/hub/[slug]. */
  isCurrentUserCoordinator?: boolean;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function HubAdminForm({ isEditing, initialData, hubSlug, isCurrentUserCoordinator = false }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState<HubData["type"]>(initialData?.type ?? "OPERATIONAL");
  const [status, setStatus] = useState<HubData["status"]>(initialData?.status ?? "ACTIVE");
  const [hasSchedule, setHasSchedule] = useState<boolean>(
    initialData?.hasSchedule ?? false,
  );
  const [assignmentGrantsTeacher, setAssignmentGrantsTeacher] = useState<boolean>(
    initialData?.assignmentGrantsTeacher ?? false,
  );
  // Mirror the ProgramEditor's teacherLabel UX so the field reads the same
  // way coordinators encounter it in both places.  Dropdown of preset
  // alternates plus a Custom… reveal.  Initial-state derivation handles
  // all save shapes — null → "default", exact preset match → preset,
  // anything else → "Custom" with text preserved.
  const HUB_LABEL_PRESETS = ["Guide", "Facilitator", "Instructor"] as const;
  const initialHubLabel = initialData?.teacherLabel ?? null;
  const initialHubLabelChoice: "default" | "Guide" | "Facilitator" | "Instructor" | "Custom" =
    initialHubLabel === null
      ? "default"
      : (HUB_LABEL_PRESETS as readonly string[]).includes(initialHubLabel)
        ? (initialHubLabel as "Guide" | "Facilitator" | "Instructor")
        : "Custom";
  const [teacherLabelChoice, setTeacherLabelChoice] =
    useState<typeof initialHubLabelChoice>(initialHubLabelChoice);
  const [teacherLabelCustom, setTeacherLabelCustom] = useState(
    initialHubLabelChoice === "Custom" ? (initialHubLabel ?? "") : "",
  );
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
  const [addingMe, setAddingMe] = useState(false);
  const [iAmCoordinator, setIAmCoordinator] = useState(isCurrentUserCoordinator);

  async function handleAddMeAsCoordinator() {
    if (!hubSlug) return;
    setAddingMe(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/hubs/${hubSlug}/add-me-as-coordinator`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add yourself as coordinator.");
      }
      setIAmCoordinator(true);
      setSuccess("You're now a coordinator of this hub.");
      // Refresh to repopulate the coordinator list display.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAddingMe(false);
    }
  }

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

    // Resolve teacherLabel from the dropdown state.
    //   "default" stores null (renderer falls through to "Teacher")
    //   preset literals store as themselves
    //   "Custom" stores the trimmed custom string, or null if empty
    const resolvedTeacherLabel: string | null =
      teacherLabelChoice === "default"
        ? null
        : teacherLabelChoice === "Custom"
          ? teacherLabelCustom.trim() || null
          : teacherLabelChoice;

    const payload = {
      name,
      slug,
      description,
      type,
      status,
      hasSchedule,
      assignmentGrantsTeacher,
      teacherLabel: resolvedTeacherLabel,
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

      {/* Runs live sessions — session 129 follow-up. Drives the hub's
          Home view (host-team-flavored vs generic) and whether the hub
          is selectable as a primary Hosting team in the Program editor.
          Pure auxiliary hubs (AV, greeter) leave this off — they staff
          supporting roles on top of a hosting team that's elsewhere. */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">
          <input
            type="checkbox"
            checked={hasSchedule}
            onChange={(e) => setHasSchedule(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          This hub runs live sessions
        </label>
        <p className="adm-hubs-hint">
          Check this for hubs that own the live session itself — Host
          Team, Peer-Led Silent Meditation, future hosting hubs. These
          hubs appear in the Program editor&rsquo;s Hosting team
          dropdown and get the host-team-style Home view (with the
          &ldquo;Our offerings this month&rdquo; panel). Leave off
          for AV, greeter, and other supporting-role hubs.
        </p>
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
              // Unchecking resets the label choice so a stale value
              // can't ride along on submit.
              if (!next) {
                setTeacherLabelChoice("default");
                setTeacherLabelCustom("");
              }
            }}
            style={{ marginRight: 8 }}
          />
          Hub assignments grant Teacher capability
        </label>
        <p className="adm-hubs-hint">
          When enabled, anyone assigned to lead a session in this hub
          automatically gets the Teacher pill and bell-friendly audio in
          the session room — without needing to be a ProgramTeacher of the
          program. Use this for peer-led offerings (silent meditation, Recovery
          Dharma, etc.) where the leader rotates each week. Leave off for
          host-team-style hubs where teachers are attributed per-program.
        </p>
      </div>

      {/* Teacher pill label — only meaningful when assignmentGrantsTeacher is true.
          Mirrors the ProgramEditor's Hosting & Access dropdown UX. */}
      {assignmentGrantsTeacher && (
        <div className="adm-hubs-field">
          <label className="adm-hubs-label">Default pill label</label>
          <p className="adm-hubs-hint">
            What the role pill reads on a leader&rsquo;s tile in the session
            room when they&rsquo;ve been assigned via this hub. Per-program
            override (on the program record itself) takes priority over this
            hub default; if both are unset, the pill falls back to
            &ldquo;Teacher.&rdquo;
          </p>
          <select
            className="adm-hubs-input"
            value={teacherLabelChoice}
            onChange={(e) =>
              setTeacherLabelChoice(
                e.target.value as
                  | "default"
                  | "Guide"
                  | "Facilitator"
                  | "Instructor"
                  | "Custom",
              )
            }
          >
            <option value="default">Teacher (default)</option>
            <option value="Guide">Guide</option>
            <option value="Facilitator">Facilitator</option>
            <option value="Instructor">Instructor</option>
            <option value="Custom">Custom…</option>
          </select>
          {teacherLabelChoice === "Custom" && (
            <input
              type="text"
              className="adm-hubs-input"
              placeholder="e.g. Co-Leader"
              value={teacherLabelCustom}
              onChange={(e) => setTeacherLabelCustom(e.target.value)}
              maxLength={20}
              style={{ marginTop: 8 }}
            />
          )}
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
          {/* Bootstrap affordance: ADMIN no longer bypasses hub access
              (session 128), so an admin who just created a hub needs a way
              to add themselves before they can reach the Members tab. */}
          {!iAmCoordinator && (
            <div className="adm-hubs-coordinator" style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={handleAddMeAsCoordinator}
                disabled={addingMe}
                className="adm-hubs-coordinator__link"
                style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
              >
                {addingMe ? "Adding…" : "+ Add me as coordinator"}
              </button>
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
