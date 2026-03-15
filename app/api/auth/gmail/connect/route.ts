/**
 * GET /api/auth/gmail/connect
 *
 * Initiates Gmail OAuth flow. ADMIN only.
 * Redirects the user to Google's consent screen.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";

export async function GET() {
  const session = await auth();
  if (!session || !(session.user.roles ?? []).includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });

  return NextResponse.redirect(url);
}
