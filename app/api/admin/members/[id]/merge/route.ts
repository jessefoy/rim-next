import { auth } from "@/auth";
import { NextResponse, after } from "next/server";
import { MergeError, mergeAccounts, previewMerge } from "@/lib/memberMerge";
import { sendAccountsMergedEmail } from "@/lib/email";

/**
 * Merging a person's two accounts (lib/memberMerge.ts). ADMIN only: it can't
 * be undone and touches everything a person has (Jesse, 2026-10-15).
 *
 *   GET  ?other=<id>               → what each account holds, which is kept,
 *                                    and the address suggested
 *   POST { otherId, email }        → merge; the kept address gets a note,
 *                                    unless the account is archived or unclaimed
 */

async function requireAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!session.user.roles?.includes("ADMIN")) {
    return { error: NextResponse.json({ error: "Only an admin can merge accounts." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const other = new URL(req.url).searchParams.get("other");
  if (!other) return NextResponse.json({ error: "Which account?" }, { status: 400 });
  const preview = await previewMerge(id, other, session.user.id);
  if (!preview) return NextResponse.json({ error: "One of these accounts no longer exists." }, { status: 404 });
  return NextResponse.json(preview);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { otherId?: unknown; email?: unknown };
  if (typeof body.otherId !== "string" || typeof body.email !== "string") {
    return NextResponse.json({ error: "Choose the address to keep." }, { status: 400 });
  }

  try {
    const result = await mergeAccounts({ idA: id, idB: body.otherId, email: body.email, byUserId: session.user.id });
    // No note to an account that is still archived or still unclaimed (the
    // quiet pool never gets email; an archived member can't sign in).
    if (result.notify) {
      after(async () => {
        try {
          await sendAccountsMergedEmail({ to: result.email, firstName: result.firstName, formerEmail: result.formerEmail });
        } catch (err) {
          console.error("[members merge] notice email failed", err);
        }
      });
    }
    console.log(`[members merge] ${session.user.id} merged ${id} and ${body.otherId} into ${result.keptId}`);
    return NextResponse.json({ ok: true, keptId: result.keptId, email: result.email, notified: result.notify });
  } catch (err) {
    if (err instanceof MergeError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("[members merge] failed", err);
    return NextResponse.json(
      { error: "The merge didn't go through, and nothing was changed. Please try again." },
      { status: 500 },
    );
  }
}
