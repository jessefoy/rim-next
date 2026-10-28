import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { messagePeople } from "@/lib/registrationActions";

// ─── POST /api/programs/[slug]/message ───────────────────────────────────────
// The Registration app's "Message people" (2026-10-23): one note to the people
// registered for a program, waiting for a place, or both. `test: true` sends
// it only to the person writing. Sent one at a time after the response
// (sendEachPaced, 600 ms apart), so a program is capped at MAX_PEOPLE to
// finish well inside maxDuration; a larger group belongs to the program's
// Flodesk segment. One email per address, if someone is listed twice.

// 50 people at about a second and a half each, with room to spare.
export const maxDuration = 300;

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
    return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
  }
  // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
  const result = await messagePeople({ id: session.user.id, roles: session.user.roles ?? [] }, slug, body);
  return NextResponse.json(result.body, { status: result.status });
}
