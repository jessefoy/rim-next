import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, roles: true, sanityInvitedAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const hasStaffRole = user.roles.includes("REGISTRAR") || user.roles.includes("ADMIN");
  if (!hasStaffRole) {
    return NextResponse.json(
      { error: "Member must have REGISTRAR or ADMIN role before being invited to Sanity" },
      { status: 400 }
    );
  }

  if (user.sanityInvitedAt) {
    return NextResponse.json(
      { error: "Already invited", sanityInvitedAt: user.sanityInvitedAt.toISOString() },
      { status: 409 }
    );
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
  const managementToken = process.env.SANITY_MANAGEMENT_TOKEN;

  if (!managementToken) {
    return NextResponse.json(
      { error: "Sanity management token not configured — add SANITY_MANAGEMENT_TOKEN to Vercel" },
      { status: 500 }
    );
  }

  const sanityRes = await fetch(
    `https://api.sanity.io/v2021-10-04/invitations/project/${projectId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: user.email, role: "editor" }),
    }
  );

  if (!sanityRes.ok) {
    const rawText = await sanityRes.text().catch(() => "");
    let sanityData: { message?: string; error?: string } = {};
    try { sanityData = JSON.parse(rawText); } catch { /* not JSON */ }
    const message =
      sanityData?.message ??
      sanityData?.error ??
      `Sanity API returned ${sanityRes.status}${rawText ? `: ${rawText.slice(0, 300)}` : ""}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const updated = await db.user.update({
    where: { id },
    data: { sanityInvitedAt: new Date() },
    select: { sanityInvitedAt: true },
  });

  return NextResponse.json({ sanityInvitedAt: updated.sanityInvitedAt!.toISOString() });
}
