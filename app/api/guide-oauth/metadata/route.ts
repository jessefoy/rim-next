import { NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/lib/guideAuth";

/**
 * How Claude finds the RIM Guide's sign-in (RFC 8414). Served at
 * /.well-known/oauth-authorization-server by a rewrite in next.config.ts.
 * The issuer is the site itself; lib/guideAuth.ts holds the rest.
 */
export function GET() {
  return NextResponse.json(
    {
      issuer: SITE_ORIGIN,
      authorization_endpoint: `${SITE_ORIGIN}/guide/connect`,
      token_endpoint: `${SITE_ORIGIN}/api/guide-oauth/token`,
      registration_endpoint: `${SITE_ORIGIN}/api/guide-oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["guide"],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
