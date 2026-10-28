import { auth } from "@/auth";
import { cancelCoverRequest } from "@/lib/scheduleActions";

// PATCH /api/host/sub-requests/[id] — cancel a sub request
// The host who owns the underlying assignment, a manager, OR a coordinator of
// the assignment's hub can cancel. Coordinator parity with the assign / unclaim
// / reassign paths — coordinators carry responsibility for their team's
// coverage, so they can clear a cover request (the host stays on).
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await cancelCoverRequest({ id: session.user.id, roles: session.user.roles ?? [] }, id);
  return Response.json(result.body, { status: result.status });
}
