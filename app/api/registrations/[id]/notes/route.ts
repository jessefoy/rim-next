import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { addRegistrationNote } from "@/lib/registrationActions";

// ─── The registration team's notes on a person (2026-10-23) ──────────────────
// Each note is written once, with its author and date. RegistrationNote.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  let body: { body?: unknown; forTeacher?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Write the note first." }, { status: 400 });
  }
  // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
  const result = await addRegistrationNote({ id: session.user.id, roles: session.user.roles ?? [] }, id, body);
  return NextResponse.json(result.body, { status: result.status });
}
