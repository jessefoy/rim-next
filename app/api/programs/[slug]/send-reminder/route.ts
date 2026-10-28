import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseRegistration } from "@/lib/toolAuth";
import { sendReminderNow } from "@/lib/registrationActions";

// ─── POST /api/programs/[slug]/send-reminder ──────────────────────────────────
// Sends the program reminder email to all active registrants who haven't
// received it yet. Used by the registrar when some people registered after
// the scheduled cron already fired.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;

  // The step itself (lib/registrationActions.ts) is shared with the RIM Guide.
  const result = await sendReminderNow({ id: session.user.id, roles: session.user.roles ?? [] }, slug);
  return NextResponse.json(result.body, { status: result.status });
}
