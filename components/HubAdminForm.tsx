"use client";

/**
 * HubAdminForm — create/edit form for admin hub management.
 * Used by /admin/hubs/new and /admin/hubs/[slug]/edit.
 * CSS prefix: adm-hubs-
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SlugField from "@/components/SlugField";
import Link from "next/link";
import {
  TOOL_REGISTRY,
  getToolBySlug,
  isToolCompatibleWithHub,
  toolCompatibilityNote,
} from "@/lib/toolRegistry";

interface AppLink {
  toolSlug: string | null;
  label: string;
  href: string;
  isEnabled: boolean;
  isPrimary: boolean;
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
   *  meditation): the hub is selectable as a Hosting team in the Program
   *  editor (with the Scheduler installed), and its sessions' room and
   *  Zoom door answer to it. Leave off for AV / greeter / future
   *  supporting-role hubs.
   *  Note: a hub having a Scheduler app link in its sidebar is a
   *  separate concern — supporting-role hubs use the Scheduler too,
   *  they just don't run the live session. */
  hasSchedule: boolean;
  conversationsEnabled?: boolean;
  /** Role-aware copy fields (session 130 follow-up). Drive the Scheduler
   *  UI and email body strings so each hub speaks its own language
   *  ("AV needed" / "You're covering AV" / "I can cover AV"). Schema
   *  defaults are the host-team strings; clearing a field in the form
   *  restores the matching default on save. */
  /** Google Workspace Files mapping (RIM_GoogleWorkspace.md) — the hub's
   *  Shared Drive + the per-hub rollout switch. Edit-mode only: a hub is
   *  mapped after its drive exists and the service account is a Manager. */
  googleDriveId?: string | null;
  /** Set when the hub is auto-provisioned (a folder in the shared Spaces
   *  drive) rather than mapped to its own whole drive — drives the "managed
   *  automatically" view vs the drive picker. */
  googleRootFolderId?: string | null;
  googleFilesEnabled?: boolean;
  coverageNoun: string;
  coverageVerb: string;
  coverageAction: string;
  /** Scheduler: several people sign up for one session (greeters) rather
   *  than one person covering it and asking for cover. */
  allowsMultipleAssignments?: boolean;
  /** Scheduler: the program formats this team staffs. */
  appliesToFormats?: string[];
  appLinks: AppLink[];
  coordinators: CoordinatorInfo[];
}

interface Props {
  isEditing: boolean;
  initialData?: HubData;
  /** Whether the Google service-account env vars are set (server-checked).
   *  False keeps the drive picker from making a guaranteed-503 fetch. */
  googleConfigured?: boolean;
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

export default function HubAdminForm({ isEditing, initialData, hubSlug, isCurrentUserCoordinator = false, googleConfigured = false }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState<HubData["type"]>(initialData?.type ?? "OPERATIONAL");
  const [status, setStatus] = useState<HubData["status"]>(initialData?.status ?? "ACTIVE");
  const [hasSchedule, setHasSchedule] = useState<boolean>(
    initialData?.hasSchedule ?? false,
  );
  const [conversationsEnabled, setConversationsEnabled] = useState<boolean>(
    initialData?.conversationsEnabled ?? true,
  );
  const [coverageNoun, setCoverageNoun] = useState<string>(
    initialData?.coverageNoun ?? "",
  );
  const [coverageVerb, setCoverageVerb] = useState<string>(
    initialData?.coverageVerb ?? "",
  );
  const [coverageAction, setCoverageAction] = useState<string>(
    initialData?.coverageAction ?? "",
  );
  const [googleDriveId, setGoogleDriveId] = useState<string>(
    initialData?.googleDriveId ?? "",
  );
  const [googleFilesEnabled, setGoogleFilesEnabled] = useState<boolean>(
    initialData?.googleFilesEnabled ?? false,
  );
  // Shared Drives the service account can see — fetched once so the admin
  // picks a drive by name instead of copying IDs. null = still loading.
  const [driveOptions, setDriveOptions] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [drivesNote, setDrivesNote] = useState<string>("");
  // True only after the list genuinely loaded — a failed fetch must not be
  // mistaken for "the mapped drive is gone" (the select labels differ).
  const [drivesLoaded, setDrivesLoaded] = useState(false);
  // One-click auto-provisioning (create this hub's folder in the shared
  // "RIM — Spaces" drive) — the no-manual-Console path for existing hubs.
  const [provisioning, setProvisioning] = useState(false);
  const [provisionNote, setProvisionNote] = useState<string>("");
  // Auto-provisioned = mapped to a drive AND folder-scoped (a folder in the
  // shared container). Drives the clean "managed automatically" view instead
  // of the drive picker (which is for own-drive/sensitive hubs only).
  const [filesManaged, setFilesManaged] = useState<boolean>(
    Boolean(initialData?.googleDriveId && initialData?.googleRootFolderId),
  );
  const [appLinks, setAppLinks] = useState<AppLink[]>(initialData?.appLinks ?? []);
  const [allowsMultipleAssignments, setAllowsMultipleAssignments] = useState<boolean>(
    initialData?.allowsMultipleAssignments ?? false,
  );
  const [appliesToFormats, setAppliesToFormats] = useState<string[]>(
    initialData?.appliesToFormats ?? ["virtual", "hybrid"],
  );
  // A save that would clear scheduled sessions waits here for a yes.
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const usesScheduler = appLinks.some((l) => l.toolSlug === "schedule" && l.isEnabled !== false);
  const coordinators = initialData?.coordinators ?? [];

  // Load the drive list for the picker (edit mode only — mapping is an
  // after-creation step). Gated on googleConfigured so an unconfigured
  // integration costs zero round-trips: that's a normal state, not an error,
  // and the section explains itself via drivesNote.
  useEffect(() => {
    if (!isEditing) return;
    if (!googleConfigured) {
      setDriveOptions([]);
      setDrivesNote(
        "Google isn't connected yet — set it up at Admin → Google connection test.",
      );
      return;
    }
    const LOAD_FAILED_NOTE =
      "Couldn't load the drive list right now. You can try again later; the rest of the form still saves.";
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/google/drives");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setDriveOptions([]);
          setDrivesNote(LOAD_FAILED_NOTE);
          return;
        }
        setDriveOptions(data.drives ?? []);
        setDrivesLoaded(true);
        if ((data.drives ?? []).length === 0) {
          setDrivesNote(
            "No Shared Drives are visible yet. Create one in Google Drive and add the RIM Files service account as a Manager — it will appear here.",
          );
        }
      } catch {
        if (!cancelled) {
          setDriveOptions([]);
          setDrivesNote(LOAD_FAILED_NOTE);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, googleConfigured]);

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
      setSuccess("You're now a coordinator of this team.");
      // Refresh to repopulate the coordinator list display.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAddingMe(false);
    }
  }

  async function handleProvisionSpace() {
    if (!hubSlug) return;
    setProvisioning(true);
    setProvisionNote("");
    try {
      const res = await fetch(`/api/admin/hubs/${hubSlug}/provision-space`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Couldn't set up files for this team.");
      }
      // Reflect the new mapping in the form so the picker + toggle update
      // without a reload; the drive now lives in the shared container.
      setGoogleDriveId(data.driveId ?? "");
      setGoogleFilesEnabled(true);
      // A provisioned hub is folder-scoped in the container → managed view.
      if (data.rootFolderId && data.rootFolderId !== data.driveId) {
        setFilesManaged(true);
      }
      setProvisionNote(
        data.alreadyMapped
          ? "This team already had files set up."
          : "Files are set up — a folder for this team was created and the Files area is on.",
      );
    } catch (err) {
      setProvisionNote(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setProvisioning(false);
    }
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing && !slugTouched) {
      setSlug(slugify(val));
    }
  }

  const usedToolSlugs = appLinks.map((l) => l.toolSlug).filter(Boolean) as string[];
  const availableTools = TOOL_REGISTRY.filter(
    (t) => !usedToolSlugs.includes(t.slug) && isToolCompatibleWithHub(t.slug, slug),
  );

  function addToolLink(toolSlug: string) {
    const tool = getToolBySlug(toolSlug);
    if (!tool) return;
    const hasPrimary = appLinks.some((link) => link.toolSlug && link.isEnabled && link.isPrimary);
    setAppLinks([
      ...appLinks,
      {
        toolSlug: tool.slug,
        label: tool.label,
        href: tool.path,
        isEnabled: true,
        isPrimary: tool.canBePrimary && !hasPrimary,
      },
    ]);
  }

  function addCustomLink() {
    setAppLinks([...appLinks, { toolSlug: null, label: "", href: "", isEnabled: true, isPrimary: false }]);
  }

  function updateAppLink(index: number, field: keyof AppLink, value: string | boolean) {
    setAppLinks((current) => {
      const next = current.map((link, i) => (i === index ? { ...link, [field]: value } : link));
      if (field === "isEnabled" && value === false && current[index]?.isPrimary) {
        const replacement = next.findIndex((link, i) => {
          const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
          return i !== index && link.isEnabled && Boolean(tool?.canBePrimary);
        });
        if (replacement >= 0) next[replacement] = { ...next[replacement], isPrimary: true };
        next[index] = { ...next[index], isPrimary: false };
      }
      return next;
    });
  }

  function removeAppLink(index: number) {
    setAppLinks((current) => {
      const removedWasPrimary = current[index]?.isPrimary;
      const next = current.filter((_, i) => i !== index);
      if (removedWasPrimary) {
        const replacement = next.findIndex((link) => {
          const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
          return link.isEnabled && Boolean(tool?.canBePrimary);
        });
        if (replacement >= 0) next[replacement] = { ...next[replacement], isPrimary: true };
      }
      return next;
    });
  }

  function setPrimaryApp(index: number) {
    setAppLinks(appLinks.map((link, i) => ({
      ...link,
      isPrimary: Boolean(i === index && link.toolSlug && link.isEnabled),
    })));
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
    await save(false);
  }

  async function save(confirmCoverageClear: boolean) {
    setSaving(true);
    setError("");
    setSuccess("");
    setPendingConfirm(null);


    // Coverage strings sent as-is (trimmed). Server resolves blank ↦
    // schema default. Server also clamps length.
    const payload = {
      name,
      slug,
      description,
      type,
      status,
      hasSchedule,
      conversationsEnabled,
      coverageNoun: coverageNoun.trim(),
      coverageVerb: coverageVerb.trim(),
      coverageAction: coverageAction.trim(),
      googleDriveId: googleDriveId || null,
      // Sent as-is: the PATCH route is the single authority for the
      // enabled-requires-drive invariant. The checkbox disable and the
      // select's onChange reset below are affordances, not enforcement.
      googleFilesEnabled,
      appLinks: appLinks.filter((l) => l.label && (l.toolSlug || l.href)),
      allowsMultipleAssignments,
      appliesToFormats,
      confirmCoverageClear,
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
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.requiresConfirmation) {
          setPendingConfirm(data.error);
          return;
        }
        throw new Error(data.error || "The team was not saved. Please try again.");
      }

      if (isEditing) {
        setSuccess("Saved. The team is updated.");
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
          warnText="Changing the slug moves this team to a new address. Its programs, schedule, files and team links to it follow; bookmarks and links in past emails won't."
          hintText={`/account/hub/${slug}`}
        />
      </div>

      {/* Description */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Description</label>
        <input
          type="text"
          className="adm-hubs-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="Your team’s shared space."
        />
        <span className="adm-hubs-hint">
          One line under the team&rsquo;s name on its Home. The team&rsquo;s leads can change it there too.
        </span>
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
          Check this for teams that run the live session itself, like the
          Hosting Team and Peer-Led Silent Meditation. With the Scheduler
          installed, they appear in the Program editor&rsquo;s Hosting team
          list. Leave it off for teams that staff a supporting role, like
          AV and greeters.
        </p>
      </div>

      {/* Per-hub feature switch — Conversations (session 165) */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">
          <input
            type="checkbox"
            checked={conversationsEnabled}
            onChange={(e) => setConversationsEnabled(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Conversations enabled
        </label>
        <p className="adm-hubs-hint">
          On for every team hub. Turn off to launch a Space narrow (the
          Community Space starts Files-only) and light Conversations up here
          when you&rsquo;re ready. When off, the Conversations tab is hidden and
          its pages are closed.
        </p>
      </div>

      {/* Team files — RIM_GoogleWorkspace.md (Files system). Edit-mode only.
          Two shapes: an auto-provisioned hub (a folder in the shared
          "RIM — Spaces" drive) shows a clean managed view; everything else
          offers one-click setup plus an advanced own-drive picker for a team
          that needs its own separate Drive. */}
      {isEditing && (
        <div className="adm-hubs-field">
          <label className="adm-hubs-label">Team files</label>

          {filesManaged ? (
            <>
              <p className="adm-hubs-hint">
                Files are set up automatically for this team — a folder in the
                shared Spaces drive. Members reach it through RIM; no Google
                account needed.
              </p>
              <label className="adm-hubs-label" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={googleFilesEnabled}
                  onChange={(e) => setGoogleFilesEnabled(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Show the Files area to this hub&rsquo;s members
              </label>
            </>
          ) : (
            <>
              <p className="adm-hubs-hint">
                Members never need Google accounts — RIM checks hub membership
                and shows the files itself. New hubs are set up automatically;
                set this one up in one click.
              </p>

              {!googleDriveId && (
                <div className="adm-hubs-provision">
                  <button
                    type="button"
                    className="btn"
                    onClick={handleProvisionSpace}
                    disabled={provisioning || !googleConfigured}
                  >
                    {provisioning ? "Setting up…" : "Set up files for this team"}
                  </button>
                  {!googleConfigured && (
                    <p className="adm-hubs-hint">
                      Connect Google first at Admin &rarr; Google connection test.
                    </p>
                  )}
                </div>
              )}
              {provisionNote && <p className="adm-hubs-hint">{provisionNote}</p>}

              <label className="adm-hubs-label" style={{ marginTop: 16 }}>
                Advanced: use a separate Shared Drive
              </label>
              <p className="adm-hubs-hint">
                Only for a team that needs its own Drive (e.g. sensitive
                material). Most teams use the automatic setup above.
              </p>
              <select
                className="adm-hubs-input"
                value={googleDriveId}
                onChange={(e) => {
                  const next = e.target.value;
                  setGoogleDriveId(next);
                  if (!next) setGoogleFilesEnabled(false);
                }}
                disabled={driveOptions === null}
              >
                <option value="">
                  {driveOptions === null ? "Loading drives…" : "No drive connected"}
                </option>
                {/* Keep the mapped drive selectable while the list loads, when
                    the list can't load, and when it's genuinely absent — so an
                    accidental save can't silently clear the mapping, and the
                    label never claims more than we actually know. */}
                {googleDriveId &&
                  !(driveOptions ?? []).some((d) => d.id === googleDriveId) && (
                    <option value={googleDriveId}>
                      {driveOptions === null
                        ? "Current drive (loading list…)"
                        : drivesLoaded
                          ? "Currently mapped drive (not visible to the service account)"
                          : "Currently mapped drive"}
                    </option>
                  )}
                {(driveOptions ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {drivesNote && <p className="adm-hubs-hint">{drivesNote}</p>}
              <label className="adm-hubs-label" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={googleFilesEnabled}
                  onChange={(e) => setGoogleFilesEnabled(e.target.checked)}
                  disabled={!googleDriveId}
                  style={{ marginRight: 8 }}
                />
                Show the Files area to this hub&rsquo;s members
              </label>
              <p className="adm-hubs-hint">
                The per-hub rollout switch. Leave off until the drive is ready —
                members see nothing new until this is on.
              </p>
            </>
          )}
        </div>
      )}

      {/* Role-aware copy — session 130 follow-up. These three strings let
          the Scheduler UI and email bodies speak in each hub's own
          language ("AV needed" / "You're covering AV" / "I can cover AV")
          without code branches per hub. Leave blank to inherit the
          host-team defaults ("Host" / "hosting" / "host this"). */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Role-aware copy</label>
        <p className="adm-hubs-hint">
          How this hub&rsquo;s role appears in Scheduler UI and emails.
          Leave any field blank to use the host-team defaults
          (<em>Host</em> / <em>hosting</em> / <em>host this</em>).
        </p>

        <label className="adm-hubs-label" style={{ marginTop: 12 }}>
          Role name (noun)
        </label>
        <input
          type="text"
          className="adm-hubs-input"
          placeholder="Host"
          value={coverageNoun}
          onChange={(e) => setCoverageNoun(e.target.value)}
          maxLength={40}
        />
        <p className="adm-hubs-hint">
          Fills sentences like &ldquo;<strong>{coverageNoun.trim() || "Host"}</strong> needed&rdquo;
          and &ldquo;<strong>{coverageNoun.trim() || "Host"}</strong>: Bob.&rdquo;
        </p>

        <label className="adm-hubs-label" style={{ marginTop: 12 }}>
          Role verb (-ing form)
        </label>
        <input
          type="text"
          className="adm-hubs-input"
          placeholder="hosting"
          value={coverageVerb}
          onChange={(e) => setCoverageVerb(e.target.value)}
          maxLength={40}
        />
        <p className="adm-hubs-hint">
          Fills sentences like &ldquo;You&rsquo;re <strong>{coverageVerb.trim() || "hosting"}</strong>.&rdquo;
        </p>

        <label className="adm-hubs-label" style={{ marginTop: 12 }}>
          Role action (claim phrasing)
        </label>
        <input
          type="text"
          className="adm-hubs-input"
          placeholder="host this"
          value={coverageAction}
          onChange={(e) => setCoverageAction(e.target.value)}
          maxLength={40}
        />
        <p className="adm-hubs-hint">
          Fills sentences like &ldquo;Yes, I can <strong>{coverageAction.trim() || "host this"}</strong>.&rdquo;
        </p>
      </div>

      {/* Scheduler settings (2026-10-15): a new scheduling team is set up
          here, not by a migration. Shown once the Scheduler app is on. */}
      {usesScheduler && (
        <div className="adm-hubs-field">
          <label className="adm-hubs-label">Scheduler</label>
          <label className="adm-hubs-label" style={{ marginTop: 8, fontWeight: "normal" }}>
            <input
              type="checkbox"
              checked={allowsMultipleAssignments}
              onChange={(e) => setAllowsMultipleAssignments(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Open sign-up
          </label>
          <p className="adm-hubs-hint">
            Several people can sign up for each session, as greeters do. Leave
            it off when one person covers each session and asks the team for
            cover when they can&rsquo;t make it.
          </p>

          <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
            <legend className="adm-hubs-label">Sessions this team staffs</legend>
            {[
              { value: "virtual", label: "Virtual" },
              { value: "in-person", label: "In-person" },
              { value: "hybrid", label: "Hybrid" },
            ].map((f) => (
              <label key={f.value} className="adm-hubs-label" style={{ fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  checked={appliesToFormats.includes(f.value)}
                  onChange={(e) =>
                    setAppliesToFormats((prev) =>
                      e.target.checked ? [...prev, f.value] : prev.filter((x) => x !== f.value),
                    )
                  }
                  style={{ marginRight: 8 }}
                />
                {f.label}
              </label>
            ))}
          </fieldset>
          <p className="adm-hubs-hint">
            Programs in these formats can use this team. Removing a format
            takes those programs off the team&rsquo;s schedule; you&rsquo;ll be
            asked first if that clears anything already scheduled.
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

      {/* Apps and navigation links */}
      <div className="adm-hubs-field">
        <label className="adm-hubs-label">Apps &amp; links</label>
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
                    <div className="adm-hubs-applink__tool-desc">
                      {isToolCompatibleWithHub(tool.slug, slug)
                        ? toolCompatibilityNote(tool)
                        : "This existing installation is being preserved, but the app is not designed for this Space. Remove it only after its workflow has been moved."}
                    </div>
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
                {tool && tool.canBePrimary && link.isEnabled && (
                  <label className="adm-hubs-applink__toggle">
                    <input
                      type="radio"
                      name="primary-space-app"
                      checked={link.isPrimary}
                      onChange={() => setPrimaryApp(i)}
                    />
                    {link.isPrimary ? "Primary app" : "Make primary"}
                  </label>
                )}
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
        <p className="adm-hubs-hint">
          One enabled app leads Home; any others are supporting apps. Apps can add Home information, Updates, and tool access. Custom links remain navigation only.
        </p>
      </div>

      {/* Submit */}
      {pendingConfirm && (
        <div className="adm-hubs-error" role="alert">
          <p style={{ margin: 0 }}>{pendingConfirm}</p>
          <div className="adm-hubs-actions" style={{ marginTop: 12 }}>
            <button type="button" className="adm-hubs-btn-save" disabled={saving} onClick={() => save(true)}>
              Clear them and save
            </button>
            <button type="button" className="adm-hubs-btn-cancel" onClick={() => setPendingConfirm(null)}>
              Keep editing
            </button>
          </div>
        </div>
      )}
      <div className="adm-hubs-actions">
        <button type="submit" className="adm-hubs-btn-save" disabled={saving}>
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Team"}
        </button>
        <Link href="/admin/hubs" className="adm-hubs-btn-cancel">
          Cancel
        </Link>
      </div>
    </form>
  );
}
