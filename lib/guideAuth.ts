import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * The RIM Guide's sign-in (2026-10-27). Each volunteer connects the guide in
 * Claude with their own RIM account, so it reads what they can read on the
 * site and nothing more: OAuth 2.1 with PKCE, RIM as its own authorization
 * server (Claude's connector rules: claude.com/docs/connectors/building/authentication).
 *
 * - Claude registers itself (POST /api/guide-oauth/register). The client id is
 *   signed, carrying its redirect addresses, so nothing is stored for it.
 * - The person presses Allow on /guide/connect, signed in to RIM; that makes a
 *   one-time code, kept by hash in guide_grants for five minutes.
 * - Claude trades the code (with its PKCE verifier) for an hour's access and a
 *   refresh grant (POST /api/guide-oauth/token). Each refresh is used once and
 *   replaced; a code or refresh grant used twice revokes the whole connection.
 * - Access is a signed token naming the person. Their roles are read fresh on
 *   every call (app/api/guide-mcp/[key]/route.ts), never carried in it.
 *
 * Signed with a key derived from AUTH_SECRET, so there is no setting to add.
 */

export const ACCESS_SECONDS = 60 * 60;
const CODE_MS = 5 * 60 * 1000;
const REFRESH_MS = 60 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 60 * 1000;

export const SITE_ORIGIN = (process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app").trim().replace(/\/$/, "");

function signingKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update("rim-guide-v1").digest();
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function sign(prefix: string, payload: object): string | null {
  const key = signingKey();
  if (!key) return null;
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", key).update(`${prefix}.${body}`).digest("base64url");
  return `${prefix}.${body}.${sig}`;
}

function unsign<T>(prefix: string, token: string): T | null {
  const key = signingKey();
  if (!key || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const expected = createHmac("sha256", key).update(`${prefix}.${parts[1]}`).digest("base64url");
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(unb64(parts[1])) as T;
  } catch {
    return null;
  }
}

/**
 * Where sign-in returns someone who came from the Allow page (/login?next=).
 * Only that page: sign-in returns nowhere else, so this is no open redirect.
 */
export function guideReturnPath(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || raw.length > 4000) return null;
  return /^\/guide\/connect(\?[^#\\\s]*)?$/.test(raw) && !raw.includes("//") ? raw : null;
}

// ─── Clients and where they may send people back ────────────────────────────

const HOSTED_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/callback$/;

/** Only Claude's own callback, or Claude Code's on this computer. */
export function redirectAllowed(uri: string): boolean {
  return HOSTED_CALLBACKS.includes(uri) || LOOPBACK.test(uri);
}

/** A registered address matches as given; a loopback one on any port (RFC 8252). */
function redirectMatches(registered: string[], uri: string): boolean {
  if (registered.includes(uri)) return true;
  const strip = (u: string) => u.replace(/:\d{1,5}\//, "/");
  return LOOPBACK.test(uri) && registered.some((r) => LOOPBACK.test(r) && strip(r) === strip(uri));
}

export function makeClientId(redirectUris: string[], name: string): string | null {
  return sign("rgc", { r: redirectUris, n: name.slice(0, 80), t: Date.now() });
}

export type GuideClient = { redirectUris: string[]; name: string };

export function readClient(clientId: string): GuideClient | null {
  const c = unsign<{ r: string[]; n: string }>("rgc", clientId);
  if (!c || !Array.isArray(c.r) || !c.r.every((u) => typeof u === "string" && redirectAllowed(u))) return null;
  return { redirectUris: c.r, name: typeof c.n === "string" ? c.n : "Claude" };
}

export function clientRedirectOk(clientId: string, redirectUri: string): boolean {
  const client = readClient(clientId);
  return !!client && redirectMatches(client.redirectUris, redirectUri);
}

// ─── Codes and tokens ───────────────────────────────────────────────────────

const secret = () => randomBytes(32).toString("base64url");

/** The Allow page's one-time code, for this person, client and PKCE challenge. */
export async function issueCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const code = secret();
  await db.guideGrant.create({
    data: {
      kind: "code",
      tokenHash: hash(code),
      userId: input.userId,
      clientId: input.clientId,
      familyId: secret(),
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_MS),
    },
  });
  return code;
}

export type TokenSet = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type TokenError = { error: "invalid_grant" | "invalid_request" | "invalid_client"; error_description: string };

async function personMayConnect(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { archivedAt: true } });
  return !!user && !user.archivedAt;
}

async function issueTokens(userId: string, clientId: string, familyId: string): Promise<TokenSet | TokenError> {
  const access = sign("rga", { u: userId, f: familyId, e: Math.floor(Date.now() / 1000) + ACCESS_SECONDS });
  if (!access) return { error: "invalid_request", error_description: "The guide's sign-in isn't set up." };
  const refresh = secret();
  // Used and expired grants are no longer needed (a revoked connection's
  // grants stay until they expire, so its access stays refused).
  await db.guideGrant.deleteMany({
    where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, revokedAt: null }] },
  });
  await db.guideGrant.create({
    data: {
      kind: "refresh",
      tokenHash: hash(refresh),
      userId,
      clientId,
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_MS),
    },
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: "guide" };
}

const revokeFamily = (familyId: string) =>
  db.guideGrant.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });

/** Claude trades the Allow page's code, with its PKCE verifier, for access. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenSet | TokenError> {
  const bad = (d: string): TokenError => ({ error: "invalid_grant", error_description: d });
  if (!input.code || !input.codeVerifier) return { error: "invalid_request", error_description: "The code and its verifier are needed." };
  const grant = await db.guideGrant.findUnique({ where: { tokenHash: hash(input.code) } });
  if (!grant || grant.kind !== "code") return bad("That code isn't known.");
  if (grant.usedAt) {
    // A code used twice: someone may have copied it. End that connection.
    await revokeFamily(grant.familyId);
    return bad("That code was already used.");
  }
  if (grant.revokedAt || grant.expiresAt < new Date()) return bad("That code has expired.");
  if (grant.clientId !== input.clientId) return bad("That code was made for another client.");
  if (grant.redirectUri !== input.redirectUri) return bad("The return address doesn't match.");
  const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
  if (challenge !== grant.codeChallenge) return bad("The verifier doesn't match.");
  // Used once: only one exchange can claim it.
  const claim = await db.guideGrant.updateMany({ where: { id: grant.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claim.count === 0) {
    await revokeFamily(grant.familyId);
    return bad("That code was already used.");
  }
  if (!(await personMayConnect(grant.userId))) return bad("This account can't connect the guide.");
  return issueTokens(grant.userId, grant.clientId, grant.familyId);
}

/** Claude renews access; the refresh grant is used once and replaced. */
export async function refreshAccess(input: { refreshToken: string; clientId: string }): Promise<TokenSet | TokenError> {
  const bad = (d: string): TokenError => ({ error: "invalid_grant", error_description: d });
  if (!input.refreshToken) return { error: "invalid_request", error_description: "The refresh token is needed." };
  const grant = await db.guideGrant.findUnique({ where: { tokenHash: hash(input.refreshToken) } });
  if (!grant || grant.kind !== "refresh") return bad("That refresh token isn't known.");
  if (grant.usedAt) {
    // A retry moments later (a timed-out request, two calls renewing at
    // once) gets fresh access; a replay after that ends the connection.
    if (!grant.revokedAt && Date.now() - grant.usedAt.getTime() < REUSE_GRACE_MS && grant.clientId === input.clientId) {
      if (!(await personMayConnect(grant.userId))) return bad("This account can't connect the guide.");
      return issueTokens(grant.userId, grant.clientId, grant.familyId);
    }
    await revokeFamily(grant.familyId);
    return bad("That refresh token was already used.");
  }
  if (grant.revokedAt || grant.expiresAt < new Date()) return bad("That refresh token has expired.");
  if (input.clientId && grant.clientId !== input.clientId) return bad("That refresh token was made for another client.");
  const claim = await db.guideGrant.updateMany({ where: { id: grant.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claim.count === 0) {
    await revokeFamily(grant.familyId);
    return bad("That refresh token was already used.");
  }
  if (!(await personMayConnect(grant.userId))) {
    await revokeFamily(grant.familyId);
    return bad("This account can't connect the guide.");
  }
  return issueTokens(grant.userId, grant.clientId, grant.familyId);
}

/** Whose access this is, if it is current and its connection not revoked. */
export async function readAccess(token: string): Promise<{ userId: string } | null> {
  const t = unsign<{ u: string; f: string; e: number }>("rga", token);
  if (!t || typeof t.u !== "string" || typeof t.f !== "string" || !(t.e > Date.now() / 1000)) return null;
  const revoked = await db.guideGrant.findFirst({ where: { familyId: t.f, revokedAt: { not: null } }, select: { id: true } });
  return revoked ? null : { userId: t.u };
}
