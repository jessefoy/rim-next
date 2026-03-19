"use client";

import React from "react";
import Link from "next/link";
import {
  MEMBER_SECTIONS,
  type SerializedMember,
  type ViewerPermissions,
  type MemberSection,
} from "@/lib/memberSectionRegistry";

interface Props {
  member: SerializedMember;
  viewerPermissions: ViewerPermissions;
}

function canViewSection(
  section: MemberSection,
  viewerPermissions: ViewerPermissions,
  member: SerializedMember
): boolean {
  const hasRole = section.allowedRoles.some((r) => viewerPermissions.roles.includes(r));
  const hasGrant = viewerPermissions.sectionGrants.includes(section.id);
  const passesCondition = section.condition ? section.condition(member) : true;
  return (hasRole || hasGrant) && passesCondition;
}

export default function MemberDetail({ member, viewerPermissions }: Props) {
  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email;

  const initials =
    ((member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "")).toUpperCase() || "?";

  const joinedDate = new Date(member.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const isArchived = !!member.archivedAt;
  const archivedAt = member.archivedAt;

  return (
    <>
      <Link href="/admin/members" className="adm2-back">
        ← All members
      </Link>

      {/* ── Member header ── */}
      <div className="adm2-header">
        <div className="adm2-header__top">
          <div className="adm2-avatar">{initials}</div>
          <div className="adm2-header__info">
            <h1 className="adm2-header__name">{displayName}</h1>
            <p className="adm2-header__meta">
              {member.email}
              {" · "}Joined {joinedDate}
              {member.firstVisitDate && (
                <>{" · "}First visit {new Date(member.firstVisitDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</>
              )}
            </p>
            <div className="adm2-header__badges">
              <span className={`adm2-badge adm2-badge--${member.memberStatus.toLowerCase()}`}>
                {member.memberStatus.charAt(0) + member.memberStatus.slice(1).toLowerCase()}
              </span>
              {member.roles.slice(0, 3).map((r) => (
                <span key={r} className="adm2-badge adm2-badge--role">{r}</span>
              ))}
              {member.roles.length > 3 && (
                <span className="adm2-badge adm2-badge--role">+{member.roles.length - 3} more</span>
              )}
              {member.tags.slice(0, 4).map((t) => (
                <span key={t} className="adm2-badge adm2-badge--tag">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Archived banner ── */}
      {isArchived && archivedAt && (
        <div className="adm2-archived-banner">
          This member was archived on{" "}
          {new Date(archivedAt).toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric",
          })}. They cannot log in, but their registration history is fully preserved.
        </div>
      )}

      {/* ── Section registry loop ── */}
      {MEMBER_SECTIONS.map((section) =>
        canViewSection(section, viewerPermissions, member) ? (
          <div
            key={section.id}
            className={section.zoneStart ? "adm2-section--zone-start" : undefined}
          >
            {section.render({ member, viewerPermissions })}
          </div>
        ) : null
      )}
    </>
  );
}
