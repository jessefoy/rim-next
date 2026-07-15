/**
 * Google Workspace connection test — ADMIN only.
 *
 * Slice-1 verification for the Files system (RIM_GoogleWorkspace.md). Runs
 * server-side so credentials never reach the browser. Confirms, in order:
 *   1. the two service-account env vars are set and a token is issued,
 *   2. the Shared Drives the service account can see (RIM — Community should
 *      appear once it's been added as a Manager), and
 *   3. via the round-trip button: create doc → link-as-key permission (the
 *      sharing-policy probe) → delete.
 *
 * Modeled on /admin/zoom-test. Inert: wired into nothing else.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getGoogleAccessToken, googleConfigured } from "@/lib/google/auth";
import { listSharedDrives, type SharedDrive } from "@/lib/google/drive";
import AdminSelfTest from "@/components/admin/AdminSelfTest";
import { pill } from "@/components/admin/DiagPill";

export const metadata = { title: "Google Test — Admin" };
export const dynamic = "force-dynamic";

export default async function GoogleTestPage() {
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

  const configured = googleConfigured();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;

  // 1. Token
  let tokenOk = false;
  let tokenError: string | null = null;
  if (configured) {
    try {
      await getGoogleAccessToken();
      tokenOk = true;
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e);
    }
  }

  // 2. Shared drives (only meaningful if the token works)
  let drives: SharedDrive[] = [];
  let drivesError: string | null = null;
  if (tokenOk) {
    try {
      drives = await listSharedDrives();
    } catch (e) {
      drivesError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="adm-page adm-diag">
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Google connection test</h1>
          <p className="ac-page-sub">
            Verifies the RIM Files service account and its Shared Drives.
            Read-only checks plus a self-cleaning round-trip; admin only.
          </p>
        </div>
      </header>

      {/* Credentials */}
      <div className="adm-diag__card">
        <div className="adm-diag__label">Service account credentials</div>
        {!configured ? (
          <div>
            <div className="adm-diag__row adm-diag__row--spaced">
              {pill("warning", "Not configured")}
              <span>The Google env vars aren&rsquo;t set yet.</span>
            </div>
            <p className="adm-diag__help">
              Set <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{" "}
              <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> in Vercel — both values
              come from the service account&rsquo;s JSON key file (RIM_GoogleWorkspace.md §7).
            </p>
          </div>
        ) : tokenOk ? (
          <div className="adm-diag__row">
            {pill("success", "Connected")}
            <span>Access token issued for {serviceAccountEmail}.</span>
          </div>
        ) : (
          <div>
            <div className="adm-diag__row adm-diag__row--spaced">
              {pill("error", "Failed")}
              <span>Could not get a token.</span>
            </div>
            <pre className="adm-diag__error">{tokenError}</pre>
            <p className="adm-diag__help">
              Check that both env vars match the JSON key file exactly — the private key
              must include its BEGIN/END lines (the <code>\n</code> sequences are fine as-is).
            </p>
          </div>
        )}
      </div>

      {/* Shared drives */}
      {tokenOk && (
        <div className="adm-diag__card">
          <div className="adm-diag__label">Shared Drives the service account can see</div>
          {drivesError ? (
            <pre className="adm-diag__error">{drivesError}</pre>
          ) : drives.length === 0 ? (
            <div>
              <div className="adm-diag__row adm-diag__row--spaced">
                {pill("warning", "None visible")}
              </div>
              <p className="adm-diag__help">
                In Google Drive, create a Shared Drive and add{" "}
                <code>{serviceAccountEmail}</code> as a <strong>Manager</strong> member.
                It appears here automatically — no IDs to copy.
              </p>
            </div>
          ) : (
            <div>
              {drives.map((d) => (
                <div key={d.id} className="adm-diag__row adm-diag__row--wrap">
                  {pill("success", "Visible")}
                  <span>{d.name}</span>
                  <span className="adm-diag__id">{d.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tokenOk && drives.length > 0 && (
        <p className="adm-diag__success">
          ✓ Credentials work and {drives.length === 1 ? "a Shared Drive is" : `${drives.length} Shared Drives are`} visible.
        </p>
      )}

      {tokenOk && (
        <AdminSelfTest
          endpoint="/api/admin/google/selftest"
          title="Drive round-trip"
          blurb="Creates a throwaway Google Doc in a Shared Drive, sets the link-as-key permission (this probes the org's sharing policy), then deletes it. Nothing real is touched."
        />
      )}

      {tokenOk && (
        <AdminSelfTest
          endpoint="/api/admin/google/drive-probe"
          title="Auto-provision probe — can we create Shared Drives?"
          blurb="Tests whether the service account can create a Shared Drive on its own — the capability needed to auto-provision a Drive per hub when a hub is created. Creates a throwaway Shared Drive, confirms the service account manages it, then deletes it. If this fails with a permission error, per-hub storage will use auto-created folders instead."
        />
      )}
    </div>
  );
}
