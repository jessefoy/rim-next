/**
 * /tools/inbox/settings — Support Inbox Settings
 *
 * Sections:
 * 1. Gmail connection (ADMIN only)
 * 2. Default assignee (ADMIN only)
 * 3. Re-match member threads (ADMIN only)
 * 4. My Signature (all support members)
 * 5. Email notifications toggle (all support members)
 * 6. Templates (ADMIN only)
 *
 * Role gate: SUPPORT | ADMIN (handled by tools/inbox/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getToolHubContext } from "@/lib/toolAuth";
import SupportSettingsClient from "@/components/SupportSettingsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support Settings — Tools" };

export default async function SupportSettingsToolPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; connected?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const { hub: hubSlug, connected } = await searchParams;

  const credential = await db.gmailCredential.findFirst({
    select: { email: true, expiresAt: true },
  });

  // Get current user's signature
  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  // Get current user's notification preference + title for signature pre-fill
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { supportEmailNotifications: true, title: true },
  });

  // For ADMIN: get default assignee setting + support team members
  let defaultAssigneeId: string | null = null;
  let supportTeam: { id: string; name: string }[] = [];

  if (isAdmin) {
    const setting = await db.appSetting.findUnique({
      where: { key: "support.defaultAssigneeId" },
    });
    defaultAssigneeId = setting?.value ?? null;

    const hubContext = await getToolHubContext(hubSlug || "support");
    supportTeam = (hubContext?.members ?? []).map((m) => ({
      id: m.user.id,
      name:
        m.user.preferredName ||
        [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
        "Unknown",
    }));
  }

  // Fetch templates for ADMIN
  let templates: { id: string; name: string; subject: string; body: any; createdBy: string; updatedAt: string }[] = [];
  if (isAdmin) {
    const tpls = await db.supportTemplate.findMany({
      orderBy: { name: "asc" },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, preferredName: true },
        },
      },
    });
    templates = tpls.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      createdBy:
        t.createdBy.preferredName ||
        [t.createdBy.firstName, t.createdBy.lastName].filter(Boolean).join(" ") ||
        "Unknown",
      updatedAt: t.updatedAt.toISOString(),
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
        role: signature?.role ?? (signature ? "" : currentUser?.title ?? ""),
        tagline: signature?.tagline ?? "",
      }}
      emailNotifications={currentUser?.supportEmailNotifications ?? true}
      defaultAssigneeId={defaultAssigneeId}
      supportTeam={supportTeam}
      initialTemplates={templates}
    />
  );
}
