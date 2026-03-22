/**
 * /account/hub/[slug]/announcements — Redirects to conversations.
 * Announcements are now pinned conversation threads.
 */

import { redirect } from "next/navigation";

export default async function HubAnnouncementsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/account/hub/${slug}/conversations`);
}
