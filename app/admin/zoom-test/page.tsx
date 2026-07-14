/**
 * Zoom connection test — ADMIN only.
 *
 * Slice 0/1a verification for the Zoom migration. Runs server-side so the
 * credentials never reach the browser. Confirms three things at once:
 *   1. the S2S credentials work (a token is issued),
 *   2. both pool seats resolve (the seat emails are right), and
 *   3. each seat is Licensed + active (not Basic — Basic caps meetings at 40 min).
 *
 * This is the API-side answer to the license check we couldn't reach in the
 * Zoom admin console. Inert: read-only Zoom calls, wired into nothing else.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getZoomAccessToken,
  getZoomUser,
  ZOOM_USER_TYPE,
  type ZoomUser,
} from "@/lib/zoom";
import AdminSelfTest from "@/components/admin/AdminSelfTest";
import { pill } from "@/components/admin/DiagPill";

export const metadata = { title: "Zoom Test — Admin" };
export const dynamic = "force-dynamic";

const SEAT_EMAILS = [
  process.env.ZOOM_SEAT_A_EMAIL,
  process.env.ZOOM_SEAT_B_EMAIL,
].filter(Boolean) as string[];

type SeatCheck =
  | { ok: true; email: string; user: ZoomUser }
  | { ok: false; email: string; error: string };

export default async function ZoomTestPage() {
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

  // 1. Token
  let tokenOk = false;
  let tokenError: string | null = null;
  try {
    await getZoomAccessToken();
    tokenOk = true;
  } catch (e) {
    tokenError = e instanceof Error ? e.message : String(e);
  }

  // 2. Seats (only meaningful if the token works)
  const seats: SeatCheck[] = [];
  if (tokenOk) {
    for (const email of SEAT_EMAILS) {
      try {
        const user = await getZoomUser(email);
        seats.push({ ok: true, email, user });
      } catch (e) {
        seats.push({
          ok: false,
          email,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return (
    <div className="adm-page adm-diag">
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Zoom connection test</h1>
          <p className="ac-page-sub">
            Verifies the &ldquo;RIM Sessions&rdquo; Server-to-Server credentials and the two host
            seats. Read-only; admin only.
          </p>
        </div>
      </header>

      {/* Credentials */}
      <div className="adm-diag__card">
        <div className="adm-diag__label">API credentials</div>
        {tokenOk ? (
          <div className="adm-diag__row">
            {pill("success", "Connected")}
            <span>Access token issued successfully.</span>
          </div>
        ) : (
          <div>
            <div className="adm-diag__row adm-diag__row--spaced">
              {pill("error", "Failed")}
              <span>Could not get a token.</span>
            </div>
            <pre className="adm-diag__error">
              {tokenError}
            </pre>
            <p className="adm-diag__help">
              Check that <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_OAUTH_CLIENT_ID</code>, and{" "}
              <code>ZOOM_OAUTH_CLIENT_SECRET</code> are set in Vercel and match the RIM Sessions app.
            </p>
          </div>
        )}
      </div>

      {/* Seats */}
      {tokenOk && SEAT_EMAILS.length === 0 && (
        <div className="adm-diag__card">
          {pill("warning", "Not set")}
          <p className="adm-diag__help">
            No seat emails configured. Set <code>ZOOM_SEAT_A_EMAIL</code> and{" "}
            <code>ZOOM_SEAT_B_EMAIL</code> in Vercel.
          </p>
        </div>
      )}

      {seats.map((s, i) => {
        const seatLabel = `Seat ${String.fromCharCode(65 + i)}`;
        if (!s.ok) {
          return (
            <div key={s.email} className="adm-diag__card">
              <div className="adm-diag__label">
                {seatLabel} — {s.email}
              </div>
              <div className="adm-diag__row adm-diag__row--spaced">
                {pill("error", "Not found")}
              </div>
              <pre className="adm-diag__error">
                {s.error}
              </pre>
            </div>
          );
        }
        const { user } = s;
        const isLicensed = user.type === 2;
        const isActive = (user.status ?? "active") === "active";
        return (
          <div key={s.email} className="adm-diag__card">
            <div className="adm-diag__label">
              {seatLabel} — {s.email}
            </div>
            <div className="adm-diag__row adm-diag__row--wrap">
              {pill("success", "Found")}
              {isLicensed
                ? pill("success", "Licensed")
                : pill("warning", ZOOM_USER_TYPE[user.type] ?? `Type ${user.type}`)}
              {isActive
                ? pill("success", "Active")
                : pill("warning", user.status ?? "unknown")}
            </div>
            {!isLicensed && (
              <p className="adm-diag__warning">
                This seat is not Licensed — group meetings would cap at 40 minutes. Assign a Pro
                license to it in User Management.
              </p>
            )}
            {!isActive && (
              <p className="adm-diag__warning">
                This seat is &ldquo;{user.status}&rdquo; — accept the Zoom activation email so it can host.
              </p>
            )}
            <p className="adm-diag__id">
              userId: {user.id}
            </p>
          </div>
        );
      })}

      {tokenOk && seats.length > 0 && seats.every((s) => s.ok && s.user.type === 2 && (s.user.status ?? "active") === "active") && (
        <p className="adm-diag__success">
          ✓ All green — credentials work and both seats are Licensed and active.
        </p>
      )}

      {tokenOk && (
        <>
          <AdminSelfTest
            endpoint="/api/admin/zoom/selftest"
            title="Provisioning round-trip"
            blurb="Creates a throwaway meeting, mints a fresh host link, adds a named registrant, then deletes it. Nothing real is touched."
          />
          <AdminSelfTest
            endpoint="/api/admin/zoom/selftest-orchestration"
            title="Orchestration (DB-backed)"
            blurb="Provisions a meeting for a test occurrence, calls again to confirm it reuses the same meeting (no duplicate), then tears it down."
          />
        </>
      )}
    </div>
  );
}
