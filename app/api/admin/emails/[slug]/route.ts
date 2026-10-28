import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveEmailTemplate } from "@/lib/contentSaves";

type Params = { params: Promise<{ slug: string }> };

// ── PATCH /api/admin/emails/[slug] — save template ───────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { subject, body, enabled, userId } = await req.json();

  // The save itself (lib/contentSaves.ts) is shared with the RIM Guide.
  const result = await saveEmailTemplate(slug, { subject, body, enabled, updatedById: userId });
  return NextResponse.json(result.body, { status: result.status });
}

// ── POST /api/admin/emails/[slug]/preview is handled separately ───────────────
// Preview endpoint lives at /api/admin/emails/[slug]/preview/route.ts
