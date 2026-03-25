/**
 * /tools/inbox — Support Inbox
 *
 * Split-pane email client: thread list (left) + thread detail (right).
 * Server component fetches initial data; SupportInboxClient handles all interaction.
 * Role gate: SUPPORT | ADMIN (handled by tools/inbox/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getToolHubContext } from "@/lib/toolAuth";
import SupportInboxClient from "@/components/SupportInboxClient";


export const dynamic = "force-dynamic";

export const metadata = { title: "Support Inbox — Tools" };

export default async function SupportInboxToolPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Check if Gmail is connected
  const credential = await db.gmailCredential.findFirst({
    select: { email: true },
  });

  if (!credential) {
    return (
      <div className="si-empty">
        <p>Gmail is not connected yet.</p>
        {isAdmin && (
          <p>
            Go to the{" "}
            <a href="/tools/inbox/settings" className="si-link">
              Settings
            </a>{" "}
            to connect the support email account.
          </p>
        )}
        {!isAdmin && (
          <p>Ask an admin to connect Gmail from Settings.</p>
        )}
      </div>
    );
  }

  // Fetch support team members for assignment dropdown via hub context
  const { hub: hubSlug } = await searchParams;
  const hubContext = await getToolHubContext(hubSlug || "support");
  const supportMembers = hubContext?.members ?? [];

  const teamMembers = supportMembers.map((m) => {
    const name =
      m.user.preferredName ||
      [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    return {
      id: m.user.id,
      name: m.user.title ? `${name} — ${m.user.title}` : name,
    };
  });

  // Always include current user if admin (may not be a hub member)
  if (isAdmin && !teamMembers.find((m) => m.id === session.user.id)) {
    teamMembers.unshift({
      id: session.user.id,
      name: session.user.name || "Admin",
    });
  }

  return (
    <div>
      <SupportInboxClient
        currentUserId={session.user.id}
        currentUserName={session.user.name || "You"}
        isAdmin={isAdmin}
        teamMembers={teamMembers}
        connectedEmail={credential.email}
      />
    </div>
  );
}
