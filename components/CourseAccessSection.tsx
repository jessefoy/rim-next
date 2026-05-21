"use client";

import { useState, useEffect, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminCourse {
  slug: string;
  name: string;
  allowSelfEnroll: boolean;
  selfEnrollDanaRequired: boolean;
  requiredRoles: string[];
  linkedByPrograms: { slug: string; name: string }[];
}

interface Grant {
  id: string;
  courseSlug: string;
  createdAt: string;
}

interface MemberRegistration {
  programSlug: string;
  status: string;
}

interface Props {
  memberId: string;
  memberRoles: string[];
  memberRegistrations: MemberRegistration[];
  initialGrants: Grant[];
}

// ── Access status helpers ────────────────────────────────────────────────────

type CourseStatus =
  | { type: "free_self_enroll" }
  | { type: "dana_self_enroll" }
  | { type: "via_registration"; programs: { slug: string; name: string }[] }
  | { type: "manual_grant"; grant: Grant }
  | { type: "no_access" };

function computeStatuses(
  course: AdminCourse,
  memberRoles: string[],
  activeRegSlugs: Set<string>,
  grantsMap: Map<string, Grant>
): CourseStatus[] {
  const statuses: CourseStatus[] = [];

  // Self-enroll path — orthogonal-flag model (session 123). The course
  // is freely available to this member if allowSelfEnroll is true AND
  // they pass any role gate (empty requiredRoles = no gate). The dana
  // variant is shown when payment is required first.
  const roleOk =
    course.requiredRoles.length === 0 ||
    course.requiredRoles.some((r) => memberRoles.includes(r));
  if (course.allowSelfEnroll && roleOk) {
    statuses.push({
      type: course.selfEnrollDanaRequired ? "dana_self_enroll" : "free_self_enroll",
    });
  }

  const linkedActive = course.linkedByPrograms.filter((p) =>
    activeRegSlugs.has(p.slug)
  );
  if (linkedActive.length > 0) {
    statuses.push({ type: "via_registration", programs: linkedActive });
  }

  const grant = grantsMap.get(course.slug);
  if (grant) {
    statuses.push({ type: "manual_grant", grant });
  }

  if (statuses.length === 0) {
    statuses.push({ type: "no_access" });
  }

  return statuses;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CourseAccessSection({
  memberId,
  memberRoles,
  memberRegistrations,
  initialGrants,
}: Props) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Per-course UI state: "idle" | "confirming_grant" | "confirming_revoke" | "busy"
  const [courseUIState, setCourseUIState] = useState<
    Record<string, "idle" | "confirming_grant" | "confirming_revoke" | "busy">
  >({});

  useEffect(() => {
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCourses(data);
        else setError("Could not load courses.");
      })
      .catch(() => setError("Could not load courses."))
      .finally(() => setLoading(false));
  }, []);

  const activeRegSlugs = useMemo(
    () =>
      new Set(
        memberRegistrations
          .filter((r) => r.status === "REGISTERED" || r.status === "APPROVED")
          .map((r) => r.programSlug)
      ),
    [memberRegistrations]
  );

  const grantsMap = useMemo(
    () => new Map(grants.map((g) => [g.courseSlug, g])),
    [grants]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [courses, search]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setUIState = (
    slug: string,
    state: "idle" | "confirming_grant" | "confirming_revoke" | "busy"
  ) => {
    setCourseUIState((prev) => ({ ...prev, [slug]: state }));
  };

  const grantAccess = async (courseSlug: string) => {
    setUIState(courseSlug, "busy");
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/course-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setGrants((prev) => {
        const filtered = prev.filter((g) => g.courseSlug !== courseSlug);
        return [
          ...filtered,
          { id: data.id, courseSlug: data.courseSlug, createdAt: data.createdAt },
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setUIState(courseSlug, "idle");
    }
  };

  const revokeAccess = async (courseSlug: string) => {
    setUIState(courseSlug, "busy");
    setError("");
    try {
      const res = await fetch(
        `/api/admin/members/${memberId}/course-access?courseSlug=${encodeURIComponent(courseSlug)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      setGrants((prev) => prev.filter((g) => g.courseSlug !== courseSlug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setUIState(courseSlug, "idle");
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderCourse = (course: AdminCourse) => {
    const statuses = computeStatuses(course, memberRoles, activeRegSlugs, grantsMap);
    const uiState = courseUIState[course.slug] ?? "idle";

    const freeSelfEnroll = statuses.some((s) => s.type === "free_self_enroll");
    const danaSelfEnroll = statuses.some((s) => s.type === "dana_self_enroll");
    const hasSelfEnroll = freeSelfEnroll || danaSelfEnroll;
    const viaReg = statuses.find((s) => s.type === "via_registration") as
      | Extract<CourseStatus, { type: "via_registration" }>
      | undefined;
    const hasManualGrant = statuses.some((s) => s.type === "manual_grant");
    const hasNoAccess = statuses.every((s) => s.type === "no_access");

    // Warning text for when grant would be redundant
    let grantWarning: string | null = null;
    if (freeSelfEnroll) {
      grantWarning =
        "This member can already self-enroll in this course. A manual grant is redundant.";
    } else if (danaSelfEnroll) {
      grantWarning =
        "This member can self-enroll in this course via dana. A manual grant would bypass the dana step.";
    } else if (viaReg && !hasManualGrant) {
      const names = viaReg.programs.map((p) => p.name).join(", ");
      grantWarning = `This member already has access via their ${names} registration.`;
    }

    // Warning text shown after revoking when they still have other access
    const revokeNote: string | null =
      hasManualGrant && (hasSelfEnroll || viaReg)
        ? hasSelfEnroll
          ? "After revoking, this member will still have access — they can self-enroll in this course."
          : `After revoking, this member will still have access via their ${viaReg!.programs.map((p) => p.name).join(", ")} registration.`
        : null;

    return (
      <div key={course.slug} className="ca-course">
        <div className="ca-course__info">
          <span className="ca-course__name">{course.name}</span>
          <span className="ca-course__slug">{course.slug}</span>
        </div>

        <div className="ca-course__status">
          {freeSelfEnroll && (
            <span className="ca-badge ca-badge--members">Can self-enroll</span>
          )}
          {danaSelfEnroll && (
            <span className="ca-badge ca-badge--members">Self-enroll (dana)</span>
          )}
          {viaReg && (
            <span className="ca-badge ca-badge--reg">
              Via registration:{" "}
              {viaReg.programs.map((p) => p.name).join(", ")}
            </span>
          )}
          {hasManualGrant && (
            <span className="ca-badge ca-badge--grant">Manual grant</span>
          )}
          {hasNoAccess && (
            <span className="ca-badge ca-badge--none">No access</span>
          )}
        </div>

        <div className="ca-course__actions">
          {/* ── No manual grant: show Grant button ── */}
          {!hasManualGrant && uiState === "idle" && (
            <button
              className="ca-btn ca-btn--grant"
              onClick={() =>
                grantWarning
                  ? setUIState(course.slug, "confirming_grant")
                  : grantAccess(course.slug)
              }
            >
              Grant access
            </button>
          )}

          {/* ── Confirm grant (when warning applies) ── */}
          {!hasManualGrant && uiState === "confirming_grant" && (
            <div className="ca-confirm">
              <p className="ca-confirm__warning">⚠ {grantWarning}</p>
              <div className="ca-confirm__btns">
                <button
                  className="ca-btn ca-btn--grant-anyway"
                  onClick={() => grantAccess(course.slug)}
                >
                  Grant anyway
                </button>
                <button
                  className="ca-btn ca-btn--cancel"
                  onClick={() => setUIState(course.slug, "idle")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Has manual grant: show Revoke button ── */}
          {hasManualGrant && uiState === "idle" && (
            <button
              className="ca-btn ca-btn--revoke"
              onClick={() => setUIState(course.slug, "confirming_revoke")}
            >
              Revoke
            </button>
          )}

          {/* ── Confirm revoke ── */}
          {hasManualGrant && uiState === "confirming_revoke" && (
            <div className="ca-confirm">
              {revokeNote && (
                <p className="ca-confirm__warning ca-confirm__warning--info">
                  ℹ {revokeNote}
                </p>
              )}
              <div className="ca-confirm__btns">
                <button
                  className="ca-btn ca-btn--revoke-confirm"
                  onClick={() => revokeAccess(course.slug)}
                >
                  Revoke grant
                </button>
                <button
                  className="ca-btn ca-btn--cancel"
                  onClick={() => setUIState(course.slug, "idle")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {uiState === "busy" && (
            <span className="ca-busy">Saving…</span>
          )}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ca-section">
      <p className="adm-section__hint">
        Members automatically get access to courses linked to their registered
        programs. Use manual grants for exceptions, historical members, or
        one-off access.
      </p>

      {error && <p className="adm-save__error">{error}</p>}

      {loading ? (
        <p className="ca-loading">Loading courses…</p>
      ) : (
        <>
          <input
            type="search"
            className="ca-search"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filtered.length === 0 && (
            <p className="ca-empty">No courses found.</p>
          )}

          <div className="ca-list">
            {filtered.map(renderCourse)}
          </div>
        </>
      )}
    </div>
  );
}
