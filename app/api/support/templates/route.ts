/**
 * GET  /api/support/templates — list all templates
 * POST /api/support/templates — create a new template (ADMIN only)
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function hasSupport(roles: string[]) {
  return roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await db.supportTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      createdBy: {
        select: { firstName: true, lastName: true, preferredName: true },
      },
    },
  });

  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      createdBy:
        t.createdBy.preferredName ||
        [t.createdBy.firstName, t.createdBy.lastName].filter(Boolean).join(" ") ||
        "Unknown",
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { name, subject, body } = (await req.json()) as {
    name: string;
    subject?: string;
    body?: any;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const template = await db.supportTemplate.create({
    data: {
      name: name.trim(),
      subject: subject?.trim() ?? "",
      body: body ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ id: template.id });
}
