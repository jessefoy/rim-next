/**
 * PUT    /api/support/templates/[id] — update a template (ADMIN only)
 * DELETE /api/support/templates/[id] — delete a template (ADMIN only)
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const { name, subject, body } = (await req.json()) as {
    name?: string;
    subject?: string;
    body?: any;
  };

  const existing = await db.supportTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await db.supportTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(subject !== undefined && { subject: subject.trim() }),
      ...(body !== undefined && { body }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.supportTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await db.supportTemplate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
