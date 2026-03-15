/**
 * /account/hub/support/settings — Support Hub Settings
 *
 * Gmail connection (ADMIN only) + My Signature (all support members).
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
    />
  );
}
