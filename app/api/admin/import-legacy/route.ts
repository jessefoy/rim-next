import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseMemberstackCsv, importLegacyRecords } from "@/lib/legacyImport";

// Headroom for the bulk import (the createMany path is fast; this is a ceiling).
export const maxDuration = 60;

/**
 * POST /api/admin/import-legacy  — the one-time Memberstack migration tool.
 *
 * ADMIN-only. Accepts the raw CSV text in the body and imports each row into the
 * legacy quiet pool via lib/legacyImport. Runs on Vercel, where the database is
 * reachable (it isn't from a local machine). With { dryRun: true } it classifies
 * but writes nothing. REMOVE this route + /admin/import-legacy + lib/legacyImport
 * once the migration is complete.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user?.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { csv?: unknown; dryRun?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const csv = typeof body.csv === "string" ? body.csv : "";
  const dryRun = body.dryRun === true;
  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV provided." }, { status: 400 });
  }

  const { records, warnings } = parseMemberstackCsv(csv);
  if (records.length === 0) {
    return NextResponse.json(
      { error: "No valid records parsed from the file.", warnings: warnings.slice(0, 50) },
      { status: 400 },
    );
  }

  try {
    const result = await importLegacyRecords(records, { dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      parsed: records.length,
      warnings: warnings.slice(0, 50),
      warningCount: warnings.length,
      ...result,
    });
  } catch (err) {
    console.error("[admin/import-legacy] import failed", err);
    return NextResponse.json(
      { error: "The import failed partway. It's safe to re-run — it resumes idempotently." },
      { status: 500 },
    );
  }
}

/**
 * DELETE — clear the entire unclaimed legacy pool (every isLegacyUnclaimed=true
 * account). Promoted members (isLegacyUnclaimed=false) are never touched, so a
 * member who has already logged in and crossed the agreement gate is safe. Used
 * to reset after a test import before importing the real file.
 */
export async function DELETE() {
  const session = await auth();
  const isAdmin = session?.user?.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const res = await db.user.deleteMany({ where: { isLegacyUnclaimed: true } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
