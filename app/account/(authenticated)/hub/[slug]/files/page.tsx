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
import { hubWriteAllowed } from "@/lib/googleFiles";
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

  const roles = session.user.roles ?? [];
  const { hub, member } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || !canAccessHub(member, roles, hub.openToAllMembers)) redirect("/account/dashboard");
  if (hub.status !== "ACTIVE") redirect(`/account/hub/${slug}`);

  // An open-to-all Space (Community) has no hub drive mapping — its files live
  // on the name-resolved "RIM — Community" Drive, reached through the shared
  // `community` place (open + writable for every member, session 163). Every
  // other hub uses its own mapped drive place and the ACTIVE-membership write
  // rule. Both keys are authorized server-side by getAccessiblePlaces, so this
  // page never renders a place the Files API would refuse.
  const isCommunitySpace = hub.openToAllMembers && !hub.googleDriveId;
  if (!isCommunitySpace && (!hub.googleFilesEnabled || !hub.googleDriveId)) {
    redirect(`/account/hub/${slug}`);
  }
  const placeKey = isCommunitySpace ? "community" : `hub:${slug}`;
  const canWrite = isCommunitySpace ? true : hubWriteAllowed(roles, member?.status);

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
        places={[{ key: placeKey, name: hub.name, canWrite }]}
        initialPlaceKey={placeKey}
        showPlaces={false}
        basePath={`/account/hub/${slug}/files`}
      />
    </div>
  );
}
