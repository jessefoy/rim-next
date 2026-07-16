/**
 * POST /api/admin/migrate-documents — ADMIN only.
 *
 * Native-documents → Google Files migration control (RIM_GoogleWorkspace.md
 * §6, Slice 4). Currently supports the read-only DRY-RUN: it reports what
 * would move without writing anything to the DB or Drive — the safe first look
 * before the one-way-door cutover. The "migrate" mode is added in the write
 * step, gated behind this same ADMIN endpoint.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildMigrationDryRun } from "@/lib/documentMigration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Only admins can run the migration." }, { status: 403 });
  }

  let mode = "dry-run";
  try {
    const body = await req.json();
    if (typeof body?.mode === "string") mode = body.mode;
  } catch {
    // no body → default dry-run
  }

  if (mode !== "dry-run") {
    return NextResponse.json(
      { error: "The migrate step isn't built yet — only the dry-run is available." },
      { status: 400 },
    );
  }

  try {
    const report = await buildMigrationDryRun();
    return NextResponse.json({ mode: "dry-run", report });
  } catch (e) {
    console.error("[migrate-documents dry-run]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "The dry-run couldn't complete. Please try again." },
      { status: 502 },
    );
  }
}
