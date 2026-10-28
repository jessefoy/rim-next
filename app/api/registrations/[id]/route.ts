import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { changeRegistration, deleteRegistration } from "@/lib/registrationActions";

// ─── PATCH — update status, notes, donationStatus, or send dana reminder ─────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
    const result = await changeRegistration({ id: session.user.id, roles: session.user.roles ?? [] }, id, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ─── DELETE — permanently remove a CANCELLED registration ─────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
    const result = await deleteRegistration({ id: session.user.id, roles: session.user.roles ?? [] }, id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Delete registration error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
