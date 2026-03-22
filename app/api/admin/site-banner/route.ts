import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/admin/site-banner — current active banner
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const banner = await db.siteBanner.findFirst({
    where: { isActive: true },
    select: { id: true, body: true, createdAt: true },
  });

  return NextResponse.json({ banner });
}

// POST /api/admin/site-banner — create new banner (ADMIN only)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Deactivate any existing active banner
  await db.siteBanner.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const banner = await db.siteBanner.create({
    data: {
      body: body.trim(),
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ banner }, { status: 201 });
}

// DELETE /api/admin/site-banner?id=... — deactivate banner (ADMIN only)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.siteBanner.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
