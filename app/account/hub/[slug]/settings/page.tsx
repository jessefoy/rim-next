/**
 * /account/hub/support/settings — Support Hub Settings (ADMIN only)
 *
 * Gmail connection status, team signatures, notification preferences.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

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

  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!isAdmin) redirect(`/account/hub/support/inbox`);

  const { connected } = await searchParams;
  const credential = await db.gmailCredential.findFirst();

  return (
    <div style={{ maxWidth: 640, padding: "24px 0" }}>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>Gmail Connection</h2>

      {connected === "true" && (
        <div
          style={{
            background: "#e8f5e9",
            padding: "12px 16px",
            borderRadius: 6,
            marginBottom: 16,
            color: "#2e7d32",
          }}
        >
          Gmail connected successfully.
        </div>
      )}

      {credential ? (
        <div>
          <p>
            <strong>{credential.email}</strong> — Connected
          </p>
          <p style={{ color: "var(--rim-text-muted)", fontSize: 14, marginTop: 4 }}>
            Token expires: {credential.expiresAt.toISOString()}
          </p>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: 16 }}>
            No Gmail account connected. Connect support@rootedinmindfulness.org to start
            receiving messages.
          </p>
          <a
            href="/api/auth/gmail/connect"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "var(--rim-blue, #135274)",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Connect Gmail
          </a>
        </div>
      )}
    </div>
  );
}
