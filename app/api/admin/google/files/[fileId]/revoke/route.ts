/**
 * POST /api/admin/google/files/[fileId]/revoke — ADMIN only.
 *
 * Revokes the anyone-with-link permission on one file (RIM_GoogleWorkspace.md
 * §5's missing revocation path; backlog 2026-07-14-001). Non-destructive:
 * the file itself is untouched, and RIM's own open route re-mints a fresh
 * link on the next legitimate access — this only cuts off anyone still
 * holding the old one.
 *
 * Body: { hubId: string | null } — attribution only (which place's audit
 * trail this belongs under); every admin here is already authorized to act
 * on any file, so it isn't a security boundary.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { revokeFileLink } from "@/lib/googleFileAdmin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { fileId } = await params;

  let hubId: string | null = null;
  try {
    const body = await request.json();
    hubId = typeof body.hubId === "string" ? body.hubId : null;
  } catch {
    // No body / not JSON — hubId stays null (Community or unattributed).
  }

  try {
    const result = await revokeFileLink({ fileId, hubId, adminUserId: session.user.id });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[admin-google-revoke]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not revoke this link. Please try again." }, { status: 502 });
  }
}
