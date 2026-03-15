/**
 * GET / PUT /api/support/settings
 *
 * Manage support hub app settings (default assignee, etc.).
 * GET: returns all support-related settings.
 * PUT: updates a single setting (key + value). ADMIN only.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.appSetting.findMany({
    where: { key: { startsWith: "support." } },
  });

  const result: Record<string, string> = {};
  for (const s of settings) result[s.key] = s.value;

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!key || typeof key !== "string" || !key.startsWith("support.")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (value === null || value === "") {
    // Delete the setting
    await db.appSetting.deleteMany({ where: { key } });
  } else {
    await db.appSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
