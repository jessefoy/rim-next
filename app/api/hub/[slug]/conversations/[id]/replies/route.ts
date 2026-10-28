import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { replyToConversation } from "@/lib/teamActions";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

// POST /api/hub/[slug]/conversations/[id]/replies — add reply (any member)
//
// Notification model: every current subscriber of the thread is emailed.
// The replier itself is auto-subscribed if not already (subscribe-by-replying).
// Optional notifyUserIds: members to add as new subscribers on this reply —
// they receive this reply email and every future one.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  // The step itself (lib/teamActions.ts) is shared with the RIM Guide.
  const result = await replyToConversation({ id: session.user.id, roles: session.user.roles ?? [], name: session.user.name, email: session.user.email }, slug, id, await req.json().catch(() => ({})));
  return NextResponse.json(result.body, { status: result.status });
}
