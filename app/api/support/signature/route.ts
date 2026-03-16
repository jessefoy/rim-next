/**
 * GET  /api/support/signature — get current user's signature
 * PUT  /api/support/signature — create or update current user's signature
 *
 * Signature is appended to outbound replies via the reply route.
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

  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  if (!signature) {
    return NextResponse.json({ name: "", role: "", tagline: "" });
  }

  return NextResponse.json({
    name: signature.name,
    role: signature.role ?? "",
    tagline: signature.tagline,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, role, tagline } = await req.json();

  if (!name || !tagline) {
    return NextResponse.json(
      { error: "Name and tagline are required" },
      { status: 400 }
    );
  }

  if (name.length > 100 || (role && role.length > 100) || tagline.length > 100) {
    return NextResponse.json(
      { error: "Name, role, and tagline must each be 100 characters or fewer" },
      { status: 400 }
    );
  }

  const signature = await db.supportSignature.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      name,
      role: role || null,
      tagline,
    },
    update: {
      name,
      role: role || null,
      tagline,
    },
  });

  return NextResponse.json({
    name: signature.name,
    role: signature.role ?? "",
    tagline: signature.tagline,
  });
}
