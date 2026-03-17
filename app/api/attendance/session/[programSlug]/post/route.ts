import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { sendPostSessionNotification } from "@/lib/email";
import { extractText } from "@/lib/renderRichContent";

/**
 * POST /api/attendance/session/[programSlug]/post
 *
 * Submits the post-session form for a host. Does three things:
 * 1. Updates SessionAttendance records for flagged people (notes + routing)
 * 2. Creates or updates the SessionReport for this session
 * 3. Sends notification email(s) to Jesse and/or coordinator based on routing
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canSubmit = roles.some((r) =>
    ["HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN"].includes(r)
  );
  if (!canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { programSlug } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    sessionDate,      // ISO string — midnight CT for the session date
    flags,            // Array<{ attendanceId, note, action }>
    reflection,       // Tiptap JSON or null
    resourceUrl,      // string | null
    resourceNote,     // string | null
    assignedHostId,   // string | null — userId of the HostAssignment for this session
  } = body as {
    sessionDate: string;
    flags: Array<{ attendanceId: string; note: string | null; action: string }>;
    reflection: object | null;
    resourceUrl: string | null;
    resourceNote: string | null;
    assignedHostId: string | null;
  };

  const sessionDateParsed = new Date(sessionDate);
  if (isNaN(sessionDateParsed.getTime())) {
    return NextResponse.json({ error: "Invalid sessionDate" }, { status: 400 });
  }

  // Validate action values
  const validActions = ["NONE", "GENTLE_FOLLOWUP", "JESSE_ONLY", "TECHNICAL_ISSUE"];

  // ── 1. Update flagged attendance records ─────────────────────────────────
  const flagUpdates = flags.map((f) => {
    const action = validActions.includes(f.action) ? f.action : "NONE";
    return db.sessionAttendance.update({
      where: { id: f.attendanceId },
      data: {
        postSessionNote:   f.note ?? null,
        postSessionAction: action as "NONE" | "GENTLE_FOLLOWUP" | "JESSE_ONLY" | "TECHNICAL_ISSUE",
      },
    });
  });

  // ── 2. Upsert the SessionReport ──────────────────────────────────────────
  // sessionDate is always midnight CT — use as-is for the @@unique key.
  // submittedByAssignedHost: null = no assignment, true = match, false = mismatch.
  const submittedByAssignedHost =
    assignedHostId == null ? null : session.user.id === assignedHostId;

  const reportUpsert = db.sessionReport.upsert({
    where: { programSlug_sessionDate: { programSlug, sessionDate: sessionDateParsed } },
    create: {
      programSlug,
      sessionDate:              sessionDateParsed,
      hostId:                   session.user.id,
      submittedByAssignedHost,
      reflection:               reflection ?? Prisma.JsonNull,
      resourceUrl:              resourceUrl ?? null,
      resourceNote:             resourceNote ?? null,
    },
    update: {
      reflection:               reflection ?? Prisma.JsonNull,
      resourceUrl:              resourceUrl ?? null,
      resourceNote:             resourceNote ?? null,
      // hostId and submittedByAssignedHost stay as the original submitter's values
    },
  });

  await Promise.all([...flagUpdates, reportUpsert]);

  // ── 3. Send notification email ───────────────────────────────────────────
  // Gather all the flagged attendee data for the notification
  const flaggedWithUsers = flags.length > 0
    ? await db.sessionAttendance.findMany({
        where: { id: { in: flags.map((f) => f.attendanceId) } },
        include: {
          user: { select: { firstName: true, lastName: true, preferredName: true, email: true } },
        },
      })
    : [];

  const host = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, preferredName: true },
  });
  const hostName = host?.preferredName || host?.firstName || "Your host";

  // Build notification payload
  const flagItems = flags.map((f) => {
    const record = flaggedWithUsers.find((r) => r.id === f.attendanceId);
    const u = record?.user;
    return {
      name: u
        ? (u.preferredName || u.firstName || "") + " " + (u.lastName || "")
        : "Unknown",
      note:   f.note ?? null,
      action: f.action,
    };
  }).filter((f) => f.action !== "NONE");

  if (flagItems.length > 0 || resourceUrl) {
    await sendPostSessionNotification({
      programSlug,
      sessionDate: sessionDateParsed,
      hostName,
      flags: flagItems,
      reflection: reflection ? extractText(reflection) : null,
      resourceUrl: resourceUrl ?? null,
      resourceNote: resourceNote ?? null,
    }).catch((e) => {
      console.error("[post-session] notification email failed:", e);
    });
  }

  return NextResponse.json({ ok: true });
}
