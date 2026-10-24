import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { centralToUtc } from "@/lib/timezone";
import { recordRegistrationEvent } from "@/lib/registrationEvents";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import { getFlodeskSegment } from "@/lib/flodesk";

// ─── PATCH /api/programs/[slug]/registration-settings ────────────────────────
// The Registration app's settings panel (2026-10-23): open, not open yet (its
// opening date, 2026-10-24) or closed, places,
// the closing date, and the mailing list with its Flodesk segment (the only
// place the mailing list is set since 2026-10-24). The program's own fields, the same
// ones the program editor saves; this route writes only them, so none of the
// editor's save side effects (Zoom, the Scheduler, teams) run.
//
// Two guards:
// - Places can't drop below the places taken (registered, plus a place held
//   while someone pays), counted as the public form counts them.
// - The page sends the program's updatedAt as it loaded; if the program has
//   changed since (in the editor, or here in another tab), nothing is saved and
//   the person is asked to reload, so a save here never undoes a newer change.
//   The other way round is guarded by the editor's safe saves (2026-10-24):
//   it sends only what it changed, and a field changed here meanwhile is
//   refused there.

const PLACES_MAX = 10000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
      archivedAt: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationCapacity: true,
      registrationDeadline: true,
      registrationOpensAt: true,
      flodeskSync: true,
      flodeskSegmentId: true,
    },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  if (program.archivedAt || !program.registrationEnabled) {
    return NextResponse.json(
      { error: "Registration is off for this program. Turn it on in the program editor first." },
      { status: 409 },
    );
  }

  const loaded = typeof body.updatedAt === "string" ? new Date(body.updatedAt) : null;
  const stale = "This program was changed since the page loaded, so nothing was saved. Reload the page, then make your change again.";
  if (!loaded || isNaN(loaded.getTime()) || loaded.getTime() !== program.updatedAt.getTime()) {
    return NextResponse.json({ error: stale }, { status: 409 });
  }

  const data: {
    registrationClosed?: boolean;
    registrationCapacity?: number | null;
    registrationDeadline?: Date | null;
    registrationOpensAt?: Date | null;
    flodeskSync?: boolean | null;
    flodeskSegmentId?: string;
    flodeskSegmentName?: string;
  } = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (body.registrationClosed !== undefined) {
    if (typeof body.registrationClosed !== "boolean") {
      return NextResponse.json({ error: "Registration must be open or closed." }, { status: 422 });
    }
    if (body.registrationClosed !== program.registrationClosed) {
      data.registrationClosed = body.registrationClosed;
      changes.closed = { from: program.registrationClosed, to: body.registrationClosed };
    }
  }

  if (body.registrationCapacity !== undefined) {
    const raw = body.registrationCapacity;
    const places = raw === null || raw === "" ? null : Number(raw);
    if (places !== null && (!Number.isInteger(places) || places < 1 || places > PLACES_MAX)) {
      return NextResponse.json({ error: "Places must be a whole number of at least 1, or empty for no limit." }, { status: 422 });
    }
    if (places !== program.registrationCapacity) {
      if (places !== null) {
        const taken = await countPlacesTaken(program.id);
        if (places < taken) {
          return NextResponse.json(
            { error: `${taken} ${taken === 1 ? "place is" : "places are"} already taken, so places can't be fewer than ${taken}. Cancel someone first if a place has to go.` },
            { status: 422 },
          );
        }
      }
      data.registrationCapacity = places;
      changes.places = { from: program.registrationCapacity, to: places };
    }
  }

  if (body.registrationDeadline !== undefined) {
    const raw = body.registrationDeadline;
    let deadline: Date | null = null;
    if (raw !== null && raw !== "") {
      deadline = typeof raw === "string" ? centralToUtc(raw) : null;
      if (!deadline) {
        return NextResponse.json({ error: "That closing date isn't a date and time." }, { status: 422 });
      }
    }
    if ((deadline?.getTime() ?? null) !== (program.registrationDeadline?.getTime() ?? null)) {
      data.registrationDeadline = deadline;
      changes.closes = { from: program.registrationDeadline?.toISOString() ?? null, to: deadline?.toISOString() ?? null };
    }
  }

  if (body.registrationOpensAt !== undefined) {
    const raw = body.registrationOpensAt;
    let opens: Date | null = null;
    if (raw !== null && raw !== "") {
      opens = typeof raw === "string" ? centralToUtc(raw) : null;
      if (!opens) {
        return NextResponse.json({ error: "That opening date isn't a date and time." }, { status: 422 });
      }
    }
    if ((opens?.getTime() ?? null) !== (program.registrationOpensAt?.getTime() ?? null)) {
      data.registrationOpensAt = opens;
      changes.opens = { from: program.registrationOpensAt?.toISOString() ?? null, to: opens?.toISOString() ?? null };
    }
  }

  if (body.flodeskSync !== undefined) {
    if (body.flodeskSync !== null && typeof body.flodeskSync !== "boolean") {
      return NextResponse.json({ error: "The mailing list must be automatic, on or off." }, { status: 422 });
    }
    if (body.flodeskSync !== program.flodeskSync) {
      data.flodeskSync = body.flodeskSync;
      changes.mailingList = { from: program.flodeskSync, to: body.flodeskSync };
    }
  }

  // A segment chosen from Flodesk's list. Its name is read from Flodesk, never
  // from the request. There is no unlinking: Flodesk can't rename or delete a
  // segment, so a fresh one would duplicate it.
  if (body.flodeskSegmentId !== undefined && body.flodeskSegmentId !== null && body.flodeskSegmentId !== "") {
    if (typeof body.flodeskSegmentId !== "string") {
      return NextResponse.json({ error: "Choose the segment again from the list." }, { status: 422 });
    }
    if (body.flodeskSegmentId !== program.flodeskSegmentId) {
      let segment: { id: string; name: string } | null;
      try {
        segment = await getFlodeskSegment(body.flodeskSegmentId);
      } catch {
        return NextResponse.json({ error: "Flodesk didn't answer, so the settings weren't saved. Try again in a moment." }, { status: 503 });
      }
      if (!segment) {
        return NextResponse.json({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
      }
      data.flodeskSegmentId = segment.id;
      data.flodeskSegmentName = segment.name;
      changes.segment = { from: program.flodeskSegmentId, to: segment.name };
    }
  }

  // Never closing before it opens: it would never be open.
  const opensAfter = data.registrationOpensAt !== undefined ? data.registrationOpensAt : program.registrationOpensAt;
  const closesAfter = data.registrationDeadline !== undefined ? data.registrationDeadline : program.registrationDeadline;
  if (opensAfter && closesAfter && closesAfter <= opensAfter) {
    return NextResponse.json({ error: "The closing date comes before registration opens. Move one of them." }, { status: 422 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, updatedAt: program.updatedAt.toISOString() });
  }

  // Saved only if the program is still as the page loaded it, in one write
  // that also hands back the new updatedAt for the next save.
  let after: { updatedAt: Date };
  try {
    after = await db.program.update({
      where: { id: program.id, updatedAt: program.updatedAt },
      data,
      select: { updatedAt: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: stale }, { status: 409 });
    }
    throw err;
  }
  await recordRegistrationEvent({
    kind: "settings-changed",
    programId: program.id,
    programSlug: program.slug,
    actorId: session.user.id,
    detail: { changes } as Prisma.InputJsonValue,
  });

  return NextResponse.json({ ok: true, updatedAt: after.updatedAt.toISOString() });
}
