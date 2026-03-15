/**
 * /account/hub/support/inbox — Support Inbox
 *
 * Main inbox view for the support team.
 * Phase 1: placeholder, will be built out with thread list + detail.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";

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

  return (
    <div className="si-layout">
      <div className="si-empty">
        <p style={{ color: "var(--rim-text-muted)", padding: "40px 0", textAlign: "center" }}>
          Support Inbox — connect Gmail from the Settings tab to get started.
        </p>
      </div>
    </div>
  );
}
