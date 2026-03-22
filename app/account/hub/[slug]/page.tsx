/**
 * /account/hub/[slug] — Hub home redirects to the appropriate default tab.
 */

import { redirect } from "next/navigation";

export default async function HubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Special hubs redirect to their primary tab
  if (slug === "courses") redirect(`/account/hub/courses/courses`);
  if (slug === "registrar") redirect(`/account/hub/registrar/programs`);
  if (slug === "support") redirect(`/account/hub/support/inbox`);

  // All other hubs redirect to conversations (formerly announcements)
  redirect(`/account/hub/${slug}/conversations`);
}
