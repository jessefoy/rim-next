/**
 * GET /api/auth/gmail/callback
 *
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores them.
 * Redirects to the support hub settings page.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !(session.user.roles ?? []).includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json(
      { error: "Failed to get tokens. Try disconnecting and reconnecting." },
      { status: 400 }
    );
  }

  // Get the email address for the connected account
  oauth2.setCredentials(tokens);
  const gmail = (await import("googleapis")).google.gmail({ version: "v1", auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress ?? "unknown";

  // Upsert credential (one Gmail account connected at a time)
  await db.gmailCredential.upsert({
    where:  { email },
    create: {
      email,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expiry_date!),
    },
    update: {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expiry_date!),
    },
  });

  return NextResponse.redirect(
    new URL("/tools/inbox/settings?connected=true", req.nextUrl.origin)
  );
}
