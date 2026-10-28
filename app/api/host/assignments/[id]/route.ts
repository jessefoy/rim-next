import { auth } from "@/auth";
import { changeAssignment, deleteAssignment } from "@/lib/scheduleActions";

// Central Time, not the server's UTC (2026-10-15).


// PATCH /api/host/assignments/[id]
// Body: { action: "claim" | "unclaim" }
// claim:   anyone who may claim on this assignment's team (authorizeSelfClaim:
//          member or oversight, hosting allowed, enrolled) takes an open seat
// unclaim: owner, a manager, OR a coordinator of the assignment's hub can
//          unclaim — sets userId=null, cancels open sub requests, and notifies
//          the removed host when someone else takes them off.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await changeAssignment({ id: session.user.id, roles: session.user.roles ?? [] }, id, body);
  return Response.json(result.body, { status: result.status });
}

// DELETE /api/host/assignments/[id]
// A manager, or a coordinator of the assignment's hub, can delete any
// assignment in that hub. A HOST can delete their own assignment.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await deleteAssignment({ id: session.user.id, roles: session.user.roles ?? [] }, id);
  return Response.json(result.body, { status: result.status });
}
