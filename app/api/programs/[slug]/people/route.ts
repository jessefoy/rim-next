import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { addPerson } from "@/lib/registrationActions";

// ─── POST /api/programs/[slug]/people ────────────────────────────────────────
// The Registration app's "Add a person" (2026-10-23): someone who phoned,
// wrote, or signed up on paper. Follows the public registration POST
// (app/api/registrations/route.ts) where it matters: the program's own
// record decides the place and the dana, an existing account (or a former
// address of one) is linked and its names kept, a new person becomes a
// member, a place gives course access, and the confirmation goes through the
// one choke point. Unlike the public form it may add after registration has
// closed (that is what it's for), and the registration team says how dana
// was given. No one is ever charged here.
//
// "They'll give online" keeps the system's rule that a registered person
// whose dana is not finished hasn't had their confirmation yet: they get the
// dana link now, and the confirmation comes once, when they give (the Stripe
// webhook) or decline, or after a day for a voluntary program (the cleanup
// cron). Sending it now as well sent it twice (review, 2026-10-23).

export async function POST(
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
    return NextResponse.json({ error: "Fill in their name and email." }, { status: 400 });
  }
  // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
  const result = await addPerson({ id: session.user.id, roles: session.user.roles ?? [] }, slug, body);
  return NextResponse.json(result.body, { status: result.status });
}
