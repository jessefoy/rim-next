import { auth } from "@/auth";
import { askForCover } from "@/lib/scheduleActions";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

// (The GET listing every team's open requests was removed 2026-10-15: no
// caller used it, and it ignored teams.)

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await askForCover({ id: session.user.id, roles: session.user.roles ?? [] }, body);
  return Response.json(result.body, { status: result.status });
}
