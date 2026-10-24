"use client";

/** Who's helping: the teachers, whether a host is needed, the hosting team,
 *  the supporting teams, and the teams that prepare. One of the program
 *  editor's seven sections. */

import { memo, useEffect, useRef, useState } from "react";
import { DEFAULT_HOSTING_HUB_SLUG, EditorSection, type EditorHub, type Setter, type TeacherItem } from "./shared";

interface Props {
  isEditing: boolean;
  hubs: EditorHub[];
  programFormat: string;
  futureHostAssignmentCount: number;
  selectedTeachers: TeacherItem[];
  setSelectedTeachers: Setter<TeacherItem[]>;
  hostingRequired: boolean;
  setHostingRequired: Setter<boolean>;
  initialHostingRequired: boolean;
  hostingHubSlug: string;
  setHostingHubSlug: Setter<string>;
  initialHostingHubSlug: string;
  coverageHubSlugs: string[];
  setCoverageHubSlugs: Setter<string[]>;
  /** Teams that may prepare (active, with Helping with), and any the program has. */
  prepTeams: { id: string; slug: string; name: string; active?: boolean }[];
  /** Registration roles only: choosing teams that prepare decides who sees people's details. */
  canDecideAskers: boolean;
  helperTeams: { hubId: string; canReach: boolean }[];
  setHelperTeams: Setter<{ hubId: string; canReach: boolean }[]>;
  markDirty: () => void;
}

function HelpingSection({
  isEditing, hubs, programFormat, futureHostAssignmentCount,
  selectedTeachers, setSelectedTeachers,
  hostingRequired, setHostingRequired, initialHostingRequired,
  hostingHubSlug, setHostingHubSlug, initialHostingHubSlug,
  coverageHubSlugs, setCoverageHubSlugs,
  prepTeams, helperTeams, setHelperTeams, canDecideAskers,
  markDirty,
}: Props) {
  // "No host needed": self-led / community-led programs (Recovery Dharma,
  // drop-in groups), stored as `hostingRequired` (the inverse).
  const noHostNeeded = !hostingRequired;
  const hostingRequiredChanged = hostingRequired !== initialHostingRequired;
  const hostingHubChanged = hostingHubSlug !== initialHostingHubSlug;

  // ── Teacher search ───────────────────────────────────────────────────────
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<TeacherItem[]>([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const teacherDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (teacherDebounceRef.current) clearTimeout(teacherDebounceRef.current);
    if (!teacherQuery.trim()) {
      setTeacherResults([]);
      return;
    }
    teacherDebounceRef.current = setTimeout(async () => {
      setTeacherSearching(true);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(teacherQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const mapped: TeacherItem[] = data.map((m: { id: string; firstName: string; lastName: string }) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          }));
          setTeacherResults(mapped.filter((t) => !selectedTeachers.some((s) => s.id === t.id)));
        }
      } catch {}
      setTeacherSearching(false);
    }, 300);
    // Searching runs on the query alone, as it always has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherQuery]);

  function addTeacher(teacher: TeacherItem) {
    setSelectedTeachers((prev) => [...prev, teacher]);
    setTeacherResults([]);
    setTeacherQuery("");
    markDirty();
  }

  function removeTeacher(id: string) {
    setSelectedTeachers((prev) => prev.filter((t) => t.id !== id));
    markDirty();
  }

  // Auxiliary-hub coverage: each checked slug becomes a ProgramCoverageHub
  // row on save.
  function toggleCoverageHub(slug: string, checked: boolean) {
    setCoverageHubSlugs((prev) =>
      checked ? [...prev.filter((s) => s !== slug), slug] : prev.filter((s) => s !== slug),
    );
    markDirty();
  }

  // Teams that prepare (lib/programHelpers.ts): on or off, and whether they
  // can reach people. Clicks, so each marks the page unsaved itself.
  function togglePrep(hubId: string, on: boolean) {
    setHelperTeams((prev) =>
      on
        ? [...prev.filter((h) => h.hubId !== hubId), { hubId, canReach: false }].sort((a, b) => a.hubId.localeCompare(b.hubId))
        : prev.filter((h) => h.hubId !== hubId),
    );
    markDirty();
  }
  function toggleReach(hubId: string, canReach: boolean) {
    setHelperTeams((prev) => prev.map((h) => (h.hubId === hubId ? { ...h, canReach } : h)));
    markDirty();
  }

  return (
    <EditorSection id="helping">
      <div className="pe-form">
        <div className="pe-field">
          <span className="pe-field__label">Teacher / Facilitators</span>
          <span className="pe-field__help">Search by name to link teachers to this program. In online sessions, linked teachers see the Claim Host code, so they can take host controls in Zoom if needed.</span>

          {selectedTeachers.length > 0 && (
            <div className="pe-teacher-tags">
              {selectedTeachers.map((t) => (
                <span key={t.id} className="pe-teacher-tag">
                  {t.firstName} {t.lastName}
                  <button
                    type="button"
                    className="pe-teacher-tag__remove"
                    aria-label={`Remove ${t.firstName} ${t.lastName}`}
                    onClick={() => removeTeacher(t.id)}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            className="pe-input"
            placeholder="Search teachers by name…"
            aria-label="Search teachers by name"
          />
          {teacherSearching && <span className="pe-field__help">Searching…</span>}
          {teacherResults.length > 0 && (
            <div className="pe-teacher-results">
              {teacherResults.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="pe-teacher-result"
                  onClick={() => addTeacher(t)}
                >
                  {t.firstName} {t.lastName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── No host needed (self-led / community-led) ──────────── */}
        <div className="pe-field">
          <span className="pe-field__label">Host coverage</span>
          <span className="pe-field__help">
            Most programs need someone from the hosting team on the
            schedule. Self-led or community-led offerings, like drop-in
            community groups, don&rsquo;t: check this and the hosting team
            won&rsquo;t schedule it, rotate it, or be notified about it.
            It stays fully visible on the public schedule, the member
            dashboard, and its program page, and its online room still
            works. Supporting teams added below still schedule it.
          </span>
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={noHostNeeded}
              onChange={(e) => { setHostingRequired(!e.target.checked); markDirty(); }}
            />
            <span>No host needed</span>
          </label>
          {noHostNeeded && (
            <p
              style={{
                marginTop: 8,
                fontSize: "var(--text-xs)",
                color: "var(--rim-text-muted)",
              }}
            >
              This program is self-led — the hosting settings below
              don&rsquo;t apply.
            </p>
          )}
          {isEditing && noHostNeeded && hostingRequiredChanged && futureHostAssignmentCount > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 6,
                background: "var(--color-warning-bg, #fdf6e3)",
                color: "var(--color-warning, #8a6d3b)",
                fontSize: "var(--text-xs)",
                lineHeight: 1.55,
              }}
            >
              <strong>Heads up:</strong> {futureHostAssignmentCount} upcoming
              {futureHostAssignmentCount === 1 ? " host assignment" : " host assignments"}
              {" "}and any standing rotations for this program will be removed
              when you save. Past sessions stay on the record.
            </div>
          )}
        </div>

        {/* Two kinds of team, with different meanings, said before the
            controls so coordinators have the picture first. */}
        <div
          style={{
            padding: "12px 14px",
            background: "#f5f1ea",
            borderRadius: 6,
            fontSize: "var(--text-xs)",
            lineHeight: 1.6,
            color: "var(--rim-text)",
          }}
        >
          <strong>Two kinds of team.</strong><br />
          <strong>Hosting team:</strong> the one team that runs the live
          session. It opens the online room and handles cover requests.<br />
          <strong>Auxiliary role coverage:</strong> supporting teams, such
          as AV or greeters, layered on top of the hosting team. Each
          team&rsquo;s formats decide which programs it can staff.
        </div>

        {/* ── Hosting team ───────────────────────────────────────── */}
        <div className="pe-field">
          <span className="pe-field__label">Hosting team</span>
          <span className="pe-field__help">
            Which team runs this program&rsquo;s live sessions: who takes
            them, handles cover requests, and is notified. The list shows
            teams that run sessions, have the Scheduler, and staff this
            program&rsquo;s format.
          </span>
          <select
            className="pe-input"
            aria-label="Hosting team"
            value={hostingHubSlug}
            onChange={(e) => { setHostingHubSlug(e.target.value); markDirty(); }}
          >
            <option value="">{(hubs.find((h) => h.slug === DEFAULT_HOSTING_HUB_SLUG)?.name ?? "Hosting Team") + " (default)"}</option>
            {hubs
              // Teams that run sessions AND have the Scheduler installed
              // (lib/programHub.ts hostingTeamRefusal, the server's rule).
              // The team a program already has stays listed so an
              // unrelated edit doesn't silently change it.
              .filter((h) =>
                h.slug !== DEFAULT_HOSTING_HUB_SLUG &&
                ((h.hasSchedule && h.usesScheduler && (h.appliesToFormats ?? []).includes(programFormat)) ||
                  h.slug === initialHostingHubSlug))
              .map((h) => (
                <option key={h.slug} value={h.slug}>
                  {h.name}
                </option>
              ))}
          </select>

          {/* Mid-flight change warning. Fires when the editor's current
              choice differs from what was loaded AND the current hosting
              team has upcoming sessions on this program. Saving clears
              them and that team's rotations for it (Jesse, 2026-10-15;
              the save in app/api/programs-pg/[slug]/route.ts). */}
          {isEditing && hostingHubChanged && futureHostAssignmentCount > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 6,
                background: "var(--color-warning-bg, #fdf6e3)",
                color: "var(--color-warning, #8a6d3b)",
                fontSize: "var(--text-xs)",
                lineHeight: 1.55,
              }}
            >
              <strong>Heads up:</strong> the current hosting team has{" "}
              {futureHostAssignmentCount} upcoming
              {futureHostAssignmentCount === 1 ? " session" : " sessions"} scheduled
              for this program. Saving with a new hosting team clears{" "}
              {futureHostAssignmentCount === 1 ? "it" : "them"}, along with that
              team&rsquo;s rotations for this program. The new team schedules
              from here.
            </div>
          )}
        </div>

        {/* ── Auxiliary coverage (session 129 — AV + Greeter hubs) ── */}
        {(() => {
          // Eligible auxiliary hubs: not a hosting-style hub (hasSchedule
          // false; the Hosting team list is for those), uses the Scheduler,
          // and its appliesToFormats includes the program's format. A
          // virtual-only program shows no AV/Greeter checks.
          const primarySlug = hostingHubSlug || DEFAULT_HOSTING_HUB_SLUG;
          const eligible = hubs.filter((h) => {
            if (h.hasSchedule) return false;
            if (!h.usesScheduler) return false;
            if (h.slug === primarySlug) return false;
            const formats = h.appliesToFormats ?? [];
            return formats.includes(programFormat);
          });
          if (eligible.length === 0) {
            // A calm note instead of nothing: the section exists, and no
            // supporting team staffs this format (each team's formats
            // are set in /admin/hubs, so no team is named here).
            const formatWord =
              programFormat === "in-person" ? "in-person" : programFormat === "hybrid" ? "hybrid" : "virtual";
            return (
              <fieldset className="pe-field">
                <legend className="pe-field__label">Auxiliary role coverage</legend>
                <span className="pe-field__help">
                  No supporting team staffs {formatWord} programs.
                </span>
              </fieldset>
            );
          }
          return (
            <fieldset className="pe-field">
              <legend className="pe-field__label">Auxiliary role coverage</legend>
              <span className="pe-field__help">
                Supporting teams for this program, such as AV or
                greeters.
                Each team gets its own claim/sign-up flow inside its
                own hub&rsquo;s Scheduler view; the hub&rsquo;s
                configuration decides single-slot (one volunteer) vs.
                multi-claimant (open sign-up). Layered on top of the
                Hosting team above; not a substitute.
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {eligible.map((h) => {
                  const checked = coverageHubSlugs.includes(h.slug);
                  return (
                    <label key={h.slug} className="pe-checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleCoverageHub(h.slug, e.target.checked)}
                      />
                      <span>{h.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })()}

        {/* ── Teams that prepare (2026-10-24, Phase 3 slice 5) ─────── */}
        <fieldset className="pe-field">
          <legend className="pe-field__label">Teams that prepare</legend>
          <span className="pe-field__help">
            Teams that help without being on the schedule, such as a kitchen team. Each
            sees, in its Helping with app, how many are coming and the answers to the
            questions it asks, with names. Never dana.
          </span>
          {!canDecideAskers && (
            <span className="pe-field__help">
              The registration team chooses these, since a team that prepares sees who&rsquo;s coming.
            </span>
          )}
          {prepTeams.length === 0 ? (
            <span className="pe-field__help">
              No team has Helping with installed yet. An admin can install it in a team&rsquo;s space.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {prepTeams.map((t) => {
                const row = helperTeams.find((h) => h.hubId === t.id);
                return (
                  <div key={t.id}>
                    <label className="pe-checkbox">
                      <input type="checkbox" checked={!!row} disabled={!canDecideAskers} onChange={(e) => togglePrep(t.id, e.target.checked)} />
                      <span>{t.name}{t.active === false ? " (no longer active)" : ""}</span>
                    </label>
                    {row && (
                      <label className="pe-checkbox pe-checkbox--nested">
                        <input type="checkbox" checked={row.canReach} disabled={!canDecideAskers} onChange={(e) => toggleReach(t.id, e.target.checked)} />
                        <span>Can reach people: sees their email and phone</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>
    </EditorSection>
  );
}

export default memo(HelpingSection);
