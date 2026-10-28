import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, readClient, refreshAccess } from "@/lib/guideAuth";

/**
 * Claude trades the Allow page's code for access, and renews it (RFC 6749,
 * form-encoded). Public clients with PKCE: no secret. Errors are the standard
 * codes Claude acts on: invalid_grant ends the connection, invalid_client
 * makes Claude register again.
 */
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(request: NextRequest) {
  let form: URLSearchParams;
  try {
    const type = request.headers.get("content-type") ?? "";
    form = type.includes("application/json")
      ? new URLSearchParams(Object.entries((await request.json()) as Record<string, string>))
      : new URLSearchParams(await request.text());
  } catch {
    return NextResponse.json({ error: "invalid_request", error_description: "Send the form." }, { status: 400, headers });
  }
  const get = (k: string) => form.get(k) ?? "";
  const clientId = get("client_id");

  const grantType = get("grant_type");
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers });
  }
  if (clientId && !readClient(clientId)) {
    return NextResponse.json({ error: "invalid_client", error_description: "Register again." }, { status: 401, headers });
  }

  const result =
    grantType === "authorization_code"
      ? clientId
        ? await exchangeCode({ code: get("code"), clientId, redirectUri: get("redirect_uri"), codeVerifier: get("code_verifier") })
        : { error: "invalid_request" as const, error_description: "The client id is needed." }
      : await refreshAccess({ refreshToken: get("refresh_token"), clientId });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "invalid_client" ? 401 : 400, headers });
  }
  return NextResponse.json(result, { headers });
}
