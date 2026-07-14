/**
 * /account/hub/[slug]/files — the hub's Files tab (RIM_GoogleWorkspace.md).
 *
 * The team's Shared Drive, browsed live inside the hub workspace. Renders
 * only when the hub's Files switch is on and a drive is mapped; the hub
 * layout has already applied the access door (canAccessHub).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import FilesBrowser from "@/components/FilesBrowser";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Files` };
}

export default async function HubFilesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");
  if (!hub.googleFilesEnabled || !hub.googleDriveId) redirect(`/account/hub/${slug}`);

  return (
    <div>
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Files</h1>
          <p className="ac-page-sub">
            {hub.name}&rsquo;s shared files. Documents open right here; editing
            opens in Google.
          </p>
        </div>
      </header>
      <FilesBrowser
        places={[{ key: `hub:${slug}`, name: hub.name }]}
        initialPlaceKey={`hub:${slug}`}
        showPlaces={false}
        basePath={`/account/hub/${slug}/files`}
      />
    </div>
  );
}
