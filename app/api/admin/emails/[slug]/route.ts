import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderTemplateToHtml } from "@/lib/email";

type Params = { params: Promise<{ slug: string }> };

// ── PATCH /api/admin/emails/[slug] — save template ───────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { subject, body, enabled, userId } = await req.json();

  const template = await db.emailTemplate.findUnique({ where: { slug } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.emailTemplate.update({
    where: { slug },
    data: {
      subject,
      body,
      enabled,
      updatedById: userId || null,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      subject: true,
      body: true,
      enabled: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
    updatedBy: updated.updatedBy
      ? `${updated.updatedBy.firstName ?? ""} ${updated.updatedBy.lastName ?? ""}`.trim()
      : null,
  });
}

// ── POST /api/admin/emails/[slug]/preview is handled separately ───────────────
// Preview endpoint lives at /api/admin/emails/[slug]/preview/route.ts
