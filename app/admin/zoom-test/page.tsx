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
import ZoomSelfTest from "@/components/admin/ZoomSelfTest";

export const metadata = { title: "Zoom Test — Admin" };
export const dynamic = "force-dynamic";

const SEAT_EMAILS = [
  process.env.ZOOM_SEAT_A_EMAIL,
  process.env.ZOOM_SEAT_B_EMAIL,
].filter(Boolean) as string[];

type SeatCheck =
  | { ok: true; email: string; user: ZoomUser }
  | { ok: false; email: string; error: string };

function pill(color: string, label: string) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: "var(--text-xxs)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "#fff",
        background: color,
      }}
    >
      {label}
    </span>
  );
}

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

  const labelStyle = {
    fontSize: "var(--text-label)",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--rim-mid)",
    marginBottom: 6,
  };
  const cardStyle = {
    border: "1px solid var(--rim-bg-accent)",
    borderRadius: 10,
    padding: "16px 18px",
    marginBottom: 14,
  };

  return (
    <div className="adm-page" style={{ padding: 24, maxWidth: 660 }}>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-h2)",
          fontWeight: 400,
          marginBottom: 4,
        }}
      >
        Zoom connection test
      </h1>
      <p style={{ fontSize: "var(--text-ui)", color: "var(--rim-mid)", marginBottom: 24 }}>
        Verifies the &ldquo;RIM Sessions&rdquo; Server-to-Server credentials and the two host
        seats. Read-only; admin only.
      </p>

      {/* Credentials */}
      <div style={cardStyle}>
        <div style={labelStyle}>API credentials</div>
        {tokenOk ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pill("var(--color-success)", "Connected")}
            <span style={{ fontSize: "var(--text-ui)" }}>Access token issued successfully.</span>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {pill("var(--color-error)", "Failed")}
              <span style={{ fontSize: "var(--text-ui)" }}>Could not get a token.</span>
            </div>
            <pre
              style={{
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: "var(--color-error)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {tokenError}
            </pre>
            <p style={{ fontSize: "var(--text-small)", color: "var(--rim-mid)", marginTop: 8 }}>
              Check that <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_OAUTH_CLIENT_ID</code>, and{" "}
              <code>ZOOM_OAUTH_CLIENT_SECRET</code> are set in Vercel and match the RIM Sessions app.
            </p>
          </div>
        )}
      </div>

      {/* Seats */}
      {tokenOk && SEAT_EMAILS.length === 0 && (
        <div style={cardStyle}>
          {pill("var(--color-warning)", "Not set")}
          <p style={{ fontSize: "var(--text-ui)", marginTop: 8 }}>
            No seat emails configured. Set <code>ZOOM_SEAT_A_EMAIL</code> and{" "}
            <code>ZOOM_SEAT_B_EMAIL</code> in Vercel.
          </p>
        </div>
      )}

      {seats.map((s, i) => {
        const seatLabel = `Seat ${String.fromCharCode(65 + i)}`;
        if (!s.ok) {
          return (
            <div key={s.email} style={cardStyle}>
              <div style={labelStyle}>
                {seatLabel} — {s.email}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {pill("var(--color-error)", "Not found")}
              </div>
              <pre
                style={{
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-error)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {s.error}
              </pre>
            </div>
          );
        }
        const { user } = s;
        const isLicensed = user.type === 2;
        const isActive = (user.status ?? "active") === "active";
        return (
          <div key={s.email} style={cardStyle}>
            <div style={labelStyle}>
              {seatLabel} — {s.email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {pill("var(--color-success)", "Found")}
              {isLicensed
                ? pill("var(--color-success)", "Licensed")
                : pill("var(--color-warning)", ZOOM_USER_TYPE[user.type] ?? `Type ${user.type}`)}
              {isActive
                ? pill("var(--color-success)", "Active")
                : pill("var(--color-warning)", user.status ?? "unknown")}
            </div>
            {!isLicensed && (
              <p style={{ fontSize: "var(--text-small)", color: "var(--color-warning)", marginTop: 8 }}>
                This seat is not Licensed — group meetings would cap at 40 minutes. Assign a Pro
                license to it in User Management.
              </p>
            )}
            {!isActive && (
              <p style={{ fontSize: "var(--text-small)", color: "var(--color-warning)", marginTop: 8 }}>
                This seat is &ldquo;{user.status}&rdquo; — accept the Zoom activation email so it can host.
              </p>
            )}
            <p style={{ fontSize: "var(--text-xs)", color: "var(--rim-mid)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
              userId: {user.id}
            </p>
          </div>
        );
      })}

      {tokenOk && seats.length > 0 && seats.every((s) => s.ok && s.user.type === 2 && (s.user.status ?? "active") === "active") && (
        <p style={{ fontSize: "var(--text-ui)", color: "var(--color-success)", fontWeight: 600, marginTop: 8 }}>
          ✓ All green — credentials work and both seats are Licensed and active.
        </p>
      )}

      {tokenOk && (
        <>
          <ZoomSelfTest
            endpoint="/api/admin/zoom/selftest"
            title="Provisioning round-trip"
            blurb="Creates a throwaway meeting, mints a fresh host link, adds a named registrant, then deletes it. Nothing real is touched."
          />
          <ZoomSelfTest
            endpoint="/api/admin/zoom/selftest-orchestration"
            title="Orchestration (DB-backed)"
            blurb="Provisions a meeting for a test occurrence, calls again to confirm it reuses the same meeting (no duplicate), then tears it down."
          />
        </>
      )}
    </div>
  );
}
