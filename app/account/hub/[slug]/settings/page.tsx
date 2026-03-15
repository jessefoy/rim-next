/**
 * /account/hub/support/settings — Support Hub Settings
 *
 * Sections:
 * 1. Gmail connection (ADMIN only)
 * 2. Default assignee (ADMIN only)
 * 3. Re-match member threads (ADMIN only)
 * 4. My Signature (all support members)
 * 5. Email notifications toggle (all support members)
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SupportSettingsClient from "@/components/SupportSettingsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support Settings" };

export default async function SupportSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ connected?: string }>;
}) {
  const { slug } = await params;
  if (slug !== "support") redirect(`/account/hub/${slug}`);

  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess = roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
  if (!hasAccess) redirect("/account/dashboard");

  const isAdmin = roles.includes("ADMIN");
  const { connected } = await searchParams;
  const credential = await db.gmailCredential.findFirst({
    select: { email: true, expiresAt: true },
  });

  // Get current user's signature
  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  // Get current user's notification preference
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { supportEmailNotifications: true },
  });

  // For ADMIN: get default assignee setting + support team members
  let defaultAssigneeId: string | null = null;
  let supportTeam: { id: string; name: string }[] = [];

  if (isAdmin) {
    const setting = await db.appSetting.findUnique({
      where: { key: "support.defaultAssigneeId" },
    });
    defaultAssigneeId = setting?.value ?? null;

    const supportMembers = await db.hubMember.findMany({
      where: { hub: { slug: "support" } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, preferredName: true },
        },
      },
    });
    supportTeam = supportMembers.map((m) => ({
      id: m.user.id,
      name:
        m.user.preferredName ||
        [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
        "Unknown",
    }));
  }

  return (
    <SupportSettingsClient
      isAdmin={isAdmin}
      connected={connected === "true"}
      credentialEmail={credential?.email ?? null}
      credentialExpires={credential?.expiresAt.toISOString() ?? null}
      initialSignature={{
        name: signature?.name ?? "",
        role: signature?.role ?? "",
        tagline: signature?.tagline ?? "",
      }}
      emailNotifications={currentUser?.supportEmailNotifications ?? true}
      defaultAssigneeId={defaultAssigneeId}
      supportTeam={supportTeam}
    />
  );
}
