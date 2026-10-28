import { auth } from "@/auth";
import { takeOverSession } from "@/lib/scheduleActions";

// Central Time, not the server's UTC (2026-10-15).

// POST /api/host/assignments/reassign
// A manager (HOST_MANAGER/ADMIN), or a coordinator of the session's hub, can
// reassign — swaps the current assignee (if any) for the requester (the
// coordinator/manager takes the session over themselves). Coordinator parity
// with the assign + unclaim paths: scoped to the session's own hub.
//
// Body: { currentAssignmentId } (programSlug and sessionDate are ignored: the
// assignment's own are used)
//   - If currentAssignmentId is provided, the old HostAssignment is deleted
//     (its open sub-requests are cancelled first). The previously assigned
//     host, if any, is notified.
//   - A fresh HostAssignment is created with userId = current user.
//
// Regular HOST uses the sub-request system for coverage transfers — this
// endpoint is reserved for coordinator/manager overrides.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await takeOverSession({ id: session.user.id, roles: session.user.roles ?? [] }, body);
  return Response.json(result.body, { status: result.status });
}

