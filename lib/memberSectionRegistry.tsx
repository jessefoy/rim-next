import React from "react";
import CoreRecordSection from "@/components/member-sections/CoreRecordSection";
import HouseholdSection from "@/components/HouseholdSection";
import AdminNotesSection from "@/components/member-sections/AdminNotesSection";
import RolesSection from "@/components/member-sections/RolesSection";
import HubAccessSection from "@/components/HubAccessSection";
import TeacherSection from "@/components/member-sections/TeacherSection";
import CourseAccessSection from "@/components/CourseAccessSection";
import RegistrationHistorySection from "@/components/member-sections/RegistrationHistorySection";
import DangerZoneSection from "@/components/member-sections/DangerZoneSection";

export type SerializedMember = {
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
  adminNotes: unknown;
  legacyAdminNotesHtml: string | null;
  tags: string[];
  sectionGrants: string[];
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
  registrations: {
    id: string;
    programTitle: string;
    programSlug: string;
    status: string;
    donationStatus: string;
    createdAt: string;
  }[];
  courseAccess: {
    id: string;
    courseSlug: string;
    createdAt: string;
  }[];
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
};

export type ViewerPermissions = {
  roles: string[];           // The viewing user's Role[] values
  sectionGrants: string[];   // The viewing user's sectionGrants[] values
};

export type SectionRenderProps = {
  member: SerializedMember;
  viewerPermissions: ViewerPermissions;
};

export type MemberSection = {
  id: string;
  // Roles that can see this section. A viewer sees the section if they hold any of these roles,
  // OR if the section id appears in their sectionGrants.
  allowedRoles: string[];
  // Optional: additional condition on the member data itself.
  // Section is hidden if condition returns false, even if the viewer has permission.
  condition?: (member: SerializedMember) => boolean;
  // If true, MemberDetail wraps this section in adm2-section--zone-start for breathing room.
  zoneStart?: boolean;
  render: (props: SectionRenderProps) => React.ReactNode;
};

// The section registry. Order here is display order on the page.
export const MEMBER_SECTIONS: MemberSection[] = [
  {
    id: "core-record",
    allowedRoles: ["ADMIN", "REGISTRAR"],
    render: ({ member, viewerPermissions }) => (
      <CoreRecordSection member={member} viewerPermissions={viewerPermissions} />
    ),
  },
  {
    id: "household",
    allowedRoles: ["ADMIN", "REGISTRAR"],
    render: ({ member }) => (
      <HouseholdSection memberId={member.id} household={member.household} />
    ),
  },
  {
    id: "admin-notes",
    allowedRoles: ["ADMIN"],
    zoneStart: true,
    render: ({ member }) => (
      <AdminNotesSection
        memberId={member.id}
        initialNotes={member.adminNotes}
        legacyAdminNotesHtml={member.legacyAdminNotesHtml ?? undefined}
      />
    ),
  },
  {
    id: "roles",
    allowedRoles: ["ADMIN"],
    zoneStart: true,
    render: ({ member }) => (
      <RolesSection memberId={member.id} initialRoles={member.roles} />
    ),
  },
  {
    id: "hub-access",
    allowedRoles: ["ADMIN"],
    render: ({ member }) => {
      const displayName =
        [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
      return (
        <HubAccessSection
          memberId={member.id}
          memberName={displayName}
          initialAccess={member.hubAccess}
        />
      );
    },
  },
  {
    id: "teacher",
    allowedRoles: ["ADMIN"],
    zoneStart: true,
    render: ({ member }) => (
      <TeacherSection
        memberId={member.id}
        firstName={member.firstName}
        lastName={member.lastName}
        initialIsTeacher={member.isTeacher}
        initialProfile={member.teacherProfile}
      />
    ),
  },
  {
    id: "course-access",
    allowedRoles: ["ADMIN", "REGISTRAR"],
    zoneStart: true,
    render: ({ member }) => (
      <section className="adm-section">
        <h2 className="adm-section__title">Course Access</h2>
        <CourseAccessSection
          memberId={member.id}
          memberRegistrations={member.registrations.map((r) => ({
            programSlug: r.programSlug,
            status: r.status,
          }))}
          initialGrants={member.courseAccess}
        />
      </section>
    ),
  },
  {
    id: "registrations",
    allowedRoles: ["ADMIN", "REGISTRAR"],
    render: ({ member }) => (
      <RegistrationHistorySection registrations={member.registrations} />
    ),
  },
  {
    id: "danger-zone",
    allowedRoles: ["ADMIN"],
    condition: (member) => member.registrations.length === 0,
    render: ({ member }) => (
      <DangerZoneSection memberId={member.id} />
    ),
  },
];
