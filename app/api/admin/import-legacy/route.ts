import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { importFromMemberstack } from "@/lib/legacyImport";

// Sixteen Memberstack pages and one createMany; this is a ceiling.
export const maxDuration = 60;

/**
 * POST /api/admin/import-legacy  (ADMIN only)
 *
 * Reads every Memberstack member and creates the ones not yet in the app as
 * quiet, unclaimed legacy accounts (lib/legacyImport). { dryRun: true } writes
 * nothing. Safe to run again: anyone already in the app is left untouched.
 * Remove after the domain move, with /admin/import-legacy and lib/legacyImport.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user?.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  // A preview unless the request says, exactly, dryRun: false.
  const dryRun = !(body && typeof body === "object" && (body as { dryRun?: unknown }).dryRun === false);

  try {
    const result = await importFromMemberstack({ dryRun });
    console.log(`[admin/import-legacy] ${dryRun ? "preview" : "import"}`, {
      memberstackTotal: result.memberstackTotal,
      alreadyInApp: result.alreadyInApp,
      earlierNotRecreated: result.earlierNotRecreated,
      suspectedBots: result.suspectedBots.length,
      created: result.created,
    });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    console.error("[admin/import-legacy] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `The import didn't finish: ${message} Nothing is lost; it's safe to run again.` },
      { status: 500 },
    );
  }
}
