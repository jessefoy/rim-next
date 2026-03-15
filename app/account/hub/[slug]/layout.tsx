/**
 * Hub shell layout for /account/hub/[slug]/*
 *
 * - Auth check: redirect to /login if not authenticated
 * - Hub existence: 404 if hub not found
 * - Membership check: 403 if user is not a hub member
 * - Renders: HubHeader + HubNavStrip + {children}
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubHeader from "@/components/HubHeader";
import HubNavStrip from "@/components/HubNavStrip";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function HubLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
  });

  if (!hub) notFound();

  const isMember = hub.members.some((m) => m.userId === session.user.id);
  const isAdmin  = (session.user.roles ?? []).includes("ADMIN");
  if (!isMember && !isAdmin) {
    // 403 — user is authenticated but not in this hub
    return (
      <AccountLayout>
        <div className="hub-page">
          <div className="hub-empty" style={{ padding: "40px 0" }}>
            You don&rsquo;t have access to this hub.
          </div>
        </div>
      </AccountLayout>
    );
  }

  // Build tab list
  const base = `/account/hub/${slug}`;
  const roles = session.user.roles ?? [];
  const canSeeSessionTab =
    slug === "host-team" &&
    roles.some((r) => ["HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN"].includes(r));

  const isTeacherHub    = slug === "teacher";
  const isRegistrarHub  = slug === "registrar";
  const isSupportHub    = slug === "support";

  const tabs = [
    ...(isSupportHub
      ? [{ label: "Inbox", href: `${base}/inbox` }]
      : []),
    ...(isTeacherHub
      ? [
          { label: "Courses",  href: `${base}/courses` },
          { label: "Lessons",  href: `${base}/lessons` },
        ]
      : []),
    ...(isRegistrarHub
      ? [{ label: "Programs", href: `${base}/programs` }]
      : []),
    { label: "Announcements", href: (isTeacherHub || isRegistrarHub || isSupportHub) ? `${base}/announcements` : base },
    ...(hub.hasSchedule ? [{ label: "Schedule", href: `${base}/schedule` }] : []),
    ...(canSeeSessionTab ? [{ label: "Session", href: `${base}/session` }] : []),
    { label: "Documents",     href: `${base}/documents` },
    { label: "Conversations", href: `${base}/conversations` },
    { label: "Members",       href: `${base}/members` },
    ...(isSupportHub && isAdmin
      ? [{ label: "Settings", href: `${base}/settings` }]
      : []),
  ];

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubHeader
          hubType={hub.type}
          hubName={hub.name}
          memberCount={hub.members.length}
          members={hub.members}
        />
        <HubNavStrip tabs={tabs} />
        <div className="hub-content">
          {children}
        </div>
      </div>
    </AccountLayout>
  );
}
