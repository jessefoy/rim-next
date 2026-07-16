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
import { buildMigrationDryRun, migrateDocuments } from "@/lib/documentMigration";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cap per request so a batch stays well inside maxDuration; the migrate step is
// idempotent, so the client just calls again to continue.
const MAX_MIGRATE_BATCH = 25;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Only admins can run the migration." }, { status: 403 });
  }

  let mode = "dry-run";
  let limit = MAX_MIGRATE_BATCH;
  try {
    const body = await req.json();
    if (typeof body?.mode === "string") mode = body.mode;
    if (Number.isFinite(body?.limit)) {
      limit = Math.max(1, Math.min(MAX_MIGRATE_BATCH, Math.floor(body.limit)));
    }
  } catch {
    // no body → default dry-run
  }

  if (mode === "dry-run") {
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

  if (mode === "migrate") {
    try {
      const outcome = await migrateDocuments({ limit, actorUserId: session.user.id });
      return NextResponse.json({ mode: "migrate", outcome });
    } catch (e) {
      console.error("[migrate-documents migrate]", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "The migration couldn't complete. Please try again." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}
