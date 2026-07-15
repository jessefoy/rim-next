/**
 * Google Files link administration — ADMIN only (backlog 2026-07-14-001).
 *
 * The missing other half of the link-as-key model (RIM_GoogleWorkspace.md
 * §5): RIM gates who RECEIVES a minted edit link, but until this page,
 * nothing could revoke one afterward. Two actions per place (Community or a
 * files-enabled hub, picked via ?place=): revoke a single file's link, or
 * lock the whole place down (sweep every file it has ever minted a link
 * for). Neither is destructive to the files themselves — RIM's own open
 * route re-mints a fresh link on the next legitimate access.
 *
 * The worklist is sourced from google_file_audit's mint-link entries (per
 * the backlog item's own design), with a live per-file check of whether the
 * link is still actually exposed — an admin ops console, so more technical
 * language than a member-facing surface is fine here (mirrors /admin/google-test).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllFilesPlaces, getMintedFileWorklist } from "@/lib/googleFileAdmin";
import GoogleFileAdminClient from "@/components/admin/GoogleFileAdminClient";

export const metadata = { title: "Google Files Admin" };
export const dynamic = "force-dynamic";

export default async function GoogleFilesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">
            You don&rsquo;t have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  const places = await getAllFilesPlaces();
  const { place: placeParam } = await searchParams;
  const activePlace = places.find((p) => p.key === placeParam) ?? places[0] ?? null;
  const worklist = activePlace ? await getMintedFileWorklist(activePlace.hubId) : [];

  return (
    <div className="adm-page adm-diag">
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Google Files — link administration</h1>
          <p className="ac-page-sub">
            Every file RIM has ever handed out an editable link for. Revoking
            doesn&rsquo;t touch the file — it only cuts off anyone still
            holding the old link; RIM mints a fresh one the next time someone
            opens it here.
          </p>
        </div>
      </header>

      {places.length === 0 ? (
        <div className="adm-diag__card">
          <p>No files-enabled places yet — map a hub&rsquo;s drive in Hub settings first.</p>
        </div>
      ) : (
        <>
          <nav className="adm-diag__row adm-diag__row--wrap adm-diag__places">
            {places.map((p) => (
              <a
                key={p.key}
                href={`/admin/google-files?place=${encodeURIComponent(p.key)}`}
                className={`adm-diag__place-link${p.key === activePlace?.key ? " adm-diag__place-link--active" : ""}`}
              >
                {p.name}
              </a>
            ))}
          </nav>

          {activePlace && (
            <GoogleFileAdminClient
              key={activePlace.key}
              place={{ key: activePlace.key, name: activePlace.name, hubId: activePlace.hubId }}
              initialWorklist={worklist.map((w) => ({
                ...w,
                mintedAt: w.mintedAt.toISOString(),
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
