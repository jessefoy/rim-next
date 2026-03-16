/**
 * /account/hub/support/inbox — Support Inbox
 *
 * Split-pane email client: thread list (left) + thread detail (right).
 * Server component fetches initial threads; SupportInboxClient handles all interaction.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SupportInboxClient from "@/components/SupportInboxClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support Inbox" };

export default async function SupportInboxPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== "support") redirect(`/account/hub/${slug}`);

  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess = roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
  if (!hasAccess) redirect("/account/dashboard");

  // Check if Gmail is connected
  const credential = await db.gmailCredential.findFirst({
    select: { email: true },
  });

  if (!credential) {
    const isAdmin = roles.includes("ADMIN");
    return (
      <div className="si-empty">
        <p>Gmail is not connected yet.</p>
        {isAdmin && (
          <p>
            Go to the{" "}
            <a href="/account/hub/support/settings" className="si-link">
              Settings tab
            </a>{" "}
            to connect the support email account.
          </p>
        )}
        {!isAdmin && (
          <p>Ask an admin to connect Gmail from the Settings tab.</p>
        )}
      </div>
    );
  }

  // Fetch support team members for assignment dropdown
  const supportMembers = await db.hubMember.findMany({
    where: {
      hub: { slug: "support" },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
        },
      },
    },
  });

  const teamMembers = supportMembers.map((m) => ({
    id: m.user.id,
    name:
      m.user.preferredName ||
      [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
      "Unknown",
  }));

  // Always include current user if admin (may not be a hub member)
  const isAdmin = roles.includes("ADMIN");
  if (isAdmin && !teamMembers.find((m) => m.id === session.user.id)) {
    teamMembers.unshift({
      id: session.user.id,
      name: session.user.name || "Admin",
    });
  }

  return (
    <SupportInboxClient
      currentUserId={session.user.id}
      currentUserName={session.user.name || "You"}
      isAdmin={isAdmin}
      teamMembers={teamMembers}
      connectedEmail={credential.email}
    />
  );
}
