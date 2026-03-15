/**
 * Gmail API client helper.
 *
 * - getGmailCredential(): fetch stored OAuth tokens from DB
 * - refreshAccessTokenIfNeeded(): refresh if token expires within 5 minutes
 * - getGmailClient(): returns an authenticated gmail client
 */

import { google } from "googleapis";
import { db } from "@/lib/db";

const GMAIL_CLIENT_ID     = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const GMAIL_REDIRECT_URI  = process.env.GMAIL_REDIRECT_URI!;

/** Build a fresh OAuth2 client (no tokens set). */
export function getOAuth2Client() {
  return new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
}

/** Fetch the stored Gmail credential from the database. */
export async function getGmailCredential() {
  return db.gmailCredential.findFirst();
}

/**
 * If the token expires within 5 minutes, use the refresh token to get
 * a new access token, update the DB record, and return the fresh credential.
 */
export async function refreshAccessTokenIfNeeded(
  credential: NonNullable<Awaited<ReturnType<typeof getGmailCredential>>>
) {
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (credential.expiresAt > fiveMinFromNow) return credential;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: credential.refreshToken });

  const { credentials } = await oauth2.refreshAccessToken();

  const updated = await db.gmailCredential.update({
    where: { id: credential.id },
    data: {
      accessToken: credentials.access_token!,
      expiresAt:   new Date(credentials.expiry_date!),
    },
  });

  return updated;
}

/**
 * Returns an authenticated Gmail API client.
 * Refreshes the access token if needed.
 * Throws if no credential is stored (Gmail not connected yet).
 */
export async function getGmailClient() {
  const credential = await getGmailCredential();
  if (!credential) throw new Error("Gmail not connected. Connect via Settings.");

  const fresh = await refreshAccessTokenIfNeeded(credential);
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token:  fresh.accessToken,
    refresh_token: fresh.refreshToken,
  });

  return google.gmail({ version: "v1", auth: oauth2 });
}
