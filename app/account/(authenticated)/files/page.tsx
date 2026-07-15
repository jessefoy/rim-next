/**
 * /account/files — the system-wide Finder window (RIM_GoogleWorkspace.md §3).
 *
 * A sidebar of places (Community, then each files-enabled team drive the
 * viewer can enter) and one calm folders-first listing. The per-hub Files tab
 * is the same component locked to one place; this is the "all my places"
 * door, mirroring how Documents/Mind Maps pair a hub tab with a directory.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";
import FilesBrowser from "@/components/FilesBrowser";
import { getAccessiblePlaces } from "@/lib/googleFiles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files" };

export default async function FilesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const places = await getAccessiblePlaces(session.user.id, session.user.roles ?? []);

  if (places.length === 0) {
    return (
      <AccountLayout>
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">Files</h1>
          </div>
        </header>
        <p className="gf-status">
          Files isn&rsquo;t set up yet.
          {(session.user.roles ?? []).includes("ADMIN") && (
            <> Check the connection at Admin &rarr; Google connection test, and map a hub&rsquo;s drive in Hub settings.</>
          )}
        </p>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Files</h1>
          <p className="ac-page-sub">
            Your teams&rsquo; shared files. Documents open right here; editing
            opens in Google.
          </p>
        </div>
      </header>
      <FilesBrowser
        places={places.map((p) => ({ key: p.key, name: p.name, canWrite: p.canWrite }))}
        initialPlaceKey={places[0].key}
        showPlaces
        basePath="/account/files"
      />
    </AccountLayout>
  );
}
