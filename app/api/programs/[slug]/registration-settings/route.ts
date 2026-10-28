import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { saveRegistrationSettings } from "@/lib/registrationActions";

// ─── PATCH /api/programs/[slug]/registration-settings ────────────────────────
// The Registration app's settings panel (2026-10-23): open, not open yet (its
// opening date, 2026-10-24) or closed, places,
// the closing date, and the mailing list with its Flodesk segment (the only
// place the mailing list is set since 2026-10-24). The program's own fields, the same
// ones the program editor saves; this route writes only them, so none of the
// editor's save side effects (Zoom, the Scheduler, teams) run.
//
// Two guards:
// - Places can't drop below the places taken (registered, plus a place held
//   while someone pays), counted as the public form counts them.
// - The page sends the program's updatedAt as it loaded; if the program has
//   changed since (in the editor, or here in another tab), nothing is saved and
//   the person is asked to reload, so a save here never undoes a newer change.
//   The other way round is guarded by the editor's safe saves (2026-10-24):
//   it sends only what it changed, and a field changed here meanwhile is
//   refused there.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
  const result = await saveRegistrationSettings({ id: session.user.id, roles: session.user.roles ?? [] }, slug, body);
  return NextResponse.json(result.body, { status: result.status });
}
