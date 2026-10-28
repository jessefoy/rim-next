import { auth } from "@/auth";
import { canAccessHubScheduler } from "@/lib/hubAuth";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";
import { buildHubMonthSessions } from "@/lib/scheduleSessions";
import { placeOnSession } from "@/lib/scheduleActions";

// Occurrence + date helpers (ctDateStr, isOccurrenceOnDate, shiftToDate) come
// from the shared lib/scheduleUtils.ts — the single source of truth. Do NOT
// reintroduce a private copy here: this route's old copy lacked the session-137
// endDatetime / DAILY rules and drifted from /tools/schedule + /this-week.

// GET /api/host/assignments?month=YYYY-MM&hub=<slug>
// One team's month (lib/scheduleSessions.ts): every occurrence of the
// programs it staffs, with its assignments. HubScheduleClient's month
// navigation. The month is required (the old no-month listing had no callers
// and was removed, 2026-10-15).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // e.g. "2026-03"
  // ?hub= scopes the query to one hub's view. Defaults to host-team for
  // backward-compat with the legacy callers. Session 129.
  const requestedHubSlug = searchParams.get("hub") || DEFAULT_HOSTING_HUB_SLUG;

  // Per-hub gate (session 146): you can only view a hub's Scheduler if you're
  // a member of that hub OR hold an oversight role (HOST_MANAGER / ADMIN / GT).
  // Tighter than the prior capability check, which let any HOST role-holder
  // read every hub's board regardless of membership.
  if (!(await canAccessHubScheduler(session.user.id, roles, requestedHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const match = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
  const monthN = match ? Number(match[2]) : 0;
  if (!match || monthN < 1 || monthN > 12) {
    return Response.json({ error: "Which month? (YYYY-MM)" }, { status: 400 });
  }

  // The same builder the page uses (lib/scheduleSessions.ts), so the first
  // month and every month after it are built by one rule.
  const { sessions } = await buildHubMonthSessions(requestedHubSlug, Number(match[1]), monthN - 1);
  return Response.json(sessions);
}

// POST /api/host/assignments
// Two modes:
//   action: "claim" — any HOST can create+claim a session for themselves.
//                     Creates the HostAssignment and sets userId = current user in one shot.
//   (no action)     — HOST_MANAGER/ADMIN only. Creates unclaimed or assigns to a userId.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  // The step itself (lib/scheduleActions.ts) is shared with the RIM Guide.
  const result = await placeOnSession({ id: session.user.id, roles: session.user.roles ?? [] }, body);
  return Response.json(result.body, { status: result.status });
}

