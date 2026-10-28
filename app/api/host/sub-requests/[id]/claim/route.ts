import { auth } from "@/auth";
import { coverRequest } from "@/lib/scheduleActions";

// POST /api/host/sub-requests/[id]/claim — claim an open sub request
// Body: { message? }
// Side-effect: updates assignment.userId to claimer (so session shows new host)
//
// Capability gate routes by the program's hosting hub. A peer-leader can
// claim a sub for a peer-led sit; a host-team volunteer can claim subs for
// host-team programs. ADMIN bypasses.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await coverRequest({ id: session.user.id, roles: session.user.roles ?? [] }, id, body);
  return Response.json(result.body, { status: result.status });
}
