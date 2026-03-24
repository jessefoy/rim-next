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

  // For the Course Hub, also accept UserHubAccess as an alternative to HubMember.
  // All other hubs continue to use HubMember exclusively.
  let hasAccess = isMember || isAdmin;
  if (!hasAccess && slug === "courses") {
    const ua = await db.userHubAccess.findUnique({
      where: { userId_hubSlug: { userId: session.user.id, hubSlug: "courses" } },
    });
    hasAccess = !!ua;
  }

  if (!hasAccess) {
    // 403 — user is authenticated but not in this hub
    return (
      <AccountLayout suppressSidebar>
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
  const isCourseHub    = slug === "courses";
  const isRegistrarHub = slug === "registrar";

  const tabs = [
    { label: "Home", href: base },
    ...(isCourseHub
      ? [
          { label: "Series",  href: `${base}/courses` },
          { label: "Lessons", href: `${base}/lessons` },
        ]
      : []),
    ...(isRegistrarHub
      ? [{ label: "Programs", href: `${base}/programs` }]
      : []),
    { label: "Conversations", href: `${base}/conversations` },
    { label: "Tasks",          href: `${base}/tasks` },
    { label: "Documents",     href: `${base}/documents` },
    { label: "Members",       href: `${base}/members` },
  ];

  return (
    <AccountLayout suppressSidebar>
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
