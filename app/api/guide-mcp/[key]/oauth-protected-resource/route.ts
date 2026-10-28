import { NextRequest, NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/lib/guideAuth";
import { keyMatches } from "@/lib/guideConnector";

/**
 * Where Claude learns that the RIM Guide asks each person to sign in, and
 * with whom (RFC 9728). The connector's "please sign in" answer points here;
 * `resource` is the connector's own address, exactly as it was added.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!keyMatches(key)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(
    {
      resource: `${SITE_ORIGIN}/api/guide-mcp/${key}`,
      authorization_servers: [SITE_ORIGIN],
      scopes_supported: ["guide"],
      bearer_methods_supported: ["header"],
      resource_name: "RIM Guide",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
