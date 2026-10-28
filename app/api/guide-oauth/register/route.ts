import { NextRequest, NextResponse } from "next/server";
import { makeClientId, redirectAllowed } from "@/lib/guideAuth";

/**
 * Claude registers itself to connect the RIM Guide (RFC 7591). The client id
 * is signed and carries its return addresses, so nothing is stored; only
 * Claude's own callback, or Claude Code's on this computer, is accepted.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Send JSON." }, { status: 400 });
  }
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 5 || !uris.every(redirectAllowed)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "Only Claude's own return address is accepted." },
      { status: 400 },
    );
  }
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "Claude";
  const clientId = makeClientId(uris, name);
  if (!clientId) {
    return NextResponse.json({ error: "temporarily_unavailable", error_description: "The guide's sign-in isn't set up." }, { status: 503 });
  }
  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
