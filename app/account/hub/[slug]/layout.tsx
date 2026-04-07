/**
 * Hub shell layout for /account/hub/[slug]/*
 *
 * - Auth check: redirect to /login if not authenticated
 * - Hub existence: 404 if hub not found
 * - Membership check: 403 if user is not a hub member
 * - Renders: AccountSidebar (via AccountLayout) + HubTabBar + content
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubTabBar from "@/components/HubTabBar";

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

  const hasAccess = isMember || isAdmin;

  if (!hasAccess) {
    return (
      <AccountLayout>
        <div className="hub-tabs-wrap">
          <div className="rim-empty" style={{ padding: "40px 0" }}>
            You don&rsquo;t have access to this hub.
          </div>
        </div>
      </AccountLayout>
    );
  }

  const base = `/account/hub/${slug}`;
  const isCoordinator = hub.members.some(
    (m) => m.userId === session.user.id && m.isCoordinator
  );

  const navItems = [
    { label: "Home",          href: base },
    { label: "Conversations", href: `${base}/conversations` },
    { label: "Tasks",         href: `${base}/tasks` },
    { label: "Documents",     href: `${base}/documents` },
    { label: "Members",       href: `${base}/members` },
  ];

  return (
    <AccountLayout>
      <HubTabBar
        slug={hub.slug}
        hubName={hub.name}
        hubType={hub.type as "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP"}
        memberCount={hub.members.length}
        navItems={navItems}
        appLinks={hub.appLinks}
        isCoordinator={isCoordinator}
        isAdmin={isAdmin}
      />
      <div className="hub-tabs-content">
        {children}
      </div>
    </AccountLayout>
  );
}
