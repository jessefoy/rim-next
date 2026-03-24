/**
 * Hub shell layout for /account/hub/[slug]/*
 *
 * - Auth check: redirect to /login if not authenticated
 * - Hub existence: 404 if hub not found
 * - Membership check: 403 if user is not a hub member
 * - Renders: HubSidebar (left) + main content area (right)
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubSidebar from "@/components/HubSidebar";

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
      appLinks: {
        where: { isEnabled: true },
        orderBy: { order: "asc" },
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
    return (
      <AccountLayout suppressSidebar>
        <div className="hub-shell">
          <div className="hub-main">
            <div className="hub-main__content">
              <div className="hub-empty" style={{ padding: "40px 0" }}>
                You don&rsquo;t have access to this hub.
              </div>
            </div>
          </div>
        </div>
      </AccountLayout>
    );
  }

  // Build nav items
  const base = `/account/hub/${slug}`;
  const isCourseHub    = slug === "courses";
  const isRegistrarHub = slug === "registrar";
  const isCoordinator  = hub.members.some(
    (m) => m.userId === session.user.id && m.isCoordinator
  );

  const navItems = [
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
    { label: "Tasks",         href: `${base}/tasks` },
    { label: "Documents",     href: `${base}/documents` },
    { label: "Members",       href: `${base}/members` },
  ];

  return (
    <AccountLayout suppressSidebar>
      <div className="hub-shell">
        <HubSidebar
          hub={{
            slug: hub.slug,
            name: hub.name,
            type: hub.type as "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP",
            members: hub.members,
            appLinks: hub.appLinks,
          }}
          navItems={navItems}
          isCoordinator={isCoordinator}
          isAdmin={isAdmin}
        />
        <div className="hub-main">
          <div className="hub-main__content">
            {children}
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
