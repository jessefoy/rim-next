import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountForFormerEmail, recordFormerEmail, releaseFormerEmail } from "@/lib/formerEmail";
import { Role, MemberStatus } from "@prisma/client";
import { sendRoleAssignmentEmail, sendHostRoleAssignmentEmail, sendHostManagerRoleAssignmentEmail } from "@/lib/email";
import { syncHubMembership } from "@/lib/syncHubMembership";
import { enrollMemberInRoleSeries } from "@/lib/enrollment";
import { releasePersonCoverage } from "@/lib/applyStandingAssignments";
import { deliverGapNotices, prepareGapNotices } from "@/lib/coverageNotices";

const ALL_ROLES = Object.values(Role);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const isAdmin = session?.user?.roles?.some((r) => r === "ADMIN");
  const isRegistrar = session?.user?.roles?.some((r) => r === "REGISTRAR");
  if (!isAdmin && !isRegistrar) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    action,
    firstName, lastName, phone, email, roles,
    preferredName, title, addressLine1, addressCity, addressState, addressZip,
    memberStatus, firstVisitDate, adminNotes, tags,
  } = body;

  // ── Special actions (Admin only) ─────────────────────────────────────────────

  if (action === "archive" || action === "restore") {
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (action === "archive") {
    // An archived person can't sign in, so their schedule goes with them:
    // sessions released (an open sign-up removed, a seat emptied) and their
    // rotations ended, so the daily run stops scheduling them (2026-10-16
    // audit). They aren't emailed; the team sees the open seats.
    const released = await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { archivedAt: new Date() } });
      return releasePersonCoverage(tx, id, session?.user?.id ?? id, { endRotations: true });
    });
    // Each team hears about a session within two weeks now left with no one.
    const gaps = await prepareGapNotices(released.rows, [session?.user?.id, id]);
    if (gaps.length) after(() => deliverGapNotices(gaps));
    // Force logout by deleting all active sessions
    await db.session.deleteMany({ where: { userId: id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    // Restoring also lifts an Inactive status, or the next profile save would
    // read the stale Inactive as a new archive (2026-10-19 audit).
    await db.$transaction([
      db.user.update({ where: { id }, data: { archivedAt: null } }),
      db.user.updateMany({ where: { id, memberStatus: "INACTIVE" }, data: { memberStatus: "ACTIVE" } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  // ── Profile / roles update ────────────────────────────────────────────────────

  // Validate memberStatus if provided
  const ALL_STATUSES = Object.values(MemberStatus);
  if (memberStatus !== undefined && !ALL_STATUSES.includes(memberStatus as MemberStatus)) {
    return NextResponse.json({ error: "Invalid memberStatus" }, { status: 400 });
  }

  // adminNotes requires Admin
  if (adminNotes !== undefined && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Validate roles if provided; role changes require Admin
  if (roles !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (!Array.isArray(roles) || roles.some((r: string) => !ALL_ROLES.includes(r as Role))) {
      return NextResponse.json({ error: "Invalid roles" }, { status: 400 });
    }
  }

  // Validate and check uniqueness of new email if provided
  const newEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;
  if (newEmail !== undefined) {
    if (!newEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    const conflict = await db.user.findFirst({ where: { email: newEmail, id: { not: id } } });
    if (conflict) {
      return NextResponse.json(
        { error: "That email address is already used by another member." },
        { status: 409 }
      );
    }
    // Another account's former address stays theirs (lib/formerEmail.ts).
    const formerOwner = await accountForFormerEmail(newEmail);
    if (formerOwner && formerOwner.id !== id) {
      return NextResponse.json(
        { error: "That address used to belong to another member's account." },
        { status: 409 }
      );
    }
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const emailIsChanging = newEmail !== undefined && newEmail !== user.email;
  // The form sends the status on every save, so only a different value is a
  // change. A repeated Inactive used to re-archive the person and release
  // their schedule again (2026-10-19 audit). Compared with the status the form
  // shows: an archived member always shows Inactive (CoreRecordSection), even
  // when the admin-only Archive action left the stored status Active.
  const shownStatus = user.archivedAt && user.memberStatus !== "INACTIVE" ? "INACTIVE" : user.memberStatus;
  const statusIsChanging = memberStatus !== undefined && memberStatus !== shownStatus;

  // A registrar keeps the registry, but the sign-in address and status of an
  // account that carries authority (any role, or coordinating a team) stay
  // with an admin: the old address forwards its sign-in code to the new one,
  // so changing it let a registrar sign in with that authority (2026-10-19
  // audit).
  const carriesAuthority = (user.roles as string[]).length > 0 || !!(await db.hubMember.findFirst({
    where: { userId: id, isCoordinator: true },
    select: { id: true },
  }));
  if (!isAdmin && carriesAuthority && (emailIsChanging || statusIsChanging)) {
    return NextResponse.json(
      { error: "Only an admin can change the sign-in email or status of this account." },
      { status: 403 },
    );
  }

  // Detect new REGISTRAR: role wasn't there before, but is in the incoming list
  const addingRegistrar =
    roles !== undefined &&
    !(user.roles as string[]).includes("REGISTRAR") &&
    (roles as string[]).includes("REGISTRAR");

  // Detect new HOST: role wasn't there before, but is in the incoming list
  const addingHost =
    roles !== undefined &&
    !(user.roles as string[]).includes("HOST") &&
    (roles as string[]).includes("HOST");

  // Detect new HOST_MANAGER: role wasn't there before, but is in the incoming list
  const addingHostManager =
    roles !== undefined &&
    !(user.roles as string[]).includes("HOST_MANAGER") &&
    (roles as string[]).includes("HOST_MANAGER");

  // Detect newly added roles (for series auto-enrollment)
  const newlyAddedRoles: string[] =
    roles !== undefined
      ? (roles as string[]).filter((r) => !(user.roles as string[]).includes(r))
      : [];

  // Determine archivedAt changes driven by memberStatus
  let statusDrivenArchivedAt: Date | null | undefined;
  if (statusIsChanging) {
    if (memberStatus === "INACTIVE") {
      statusDrivenArchivedAt = new Date();
    } else if (user.memberStatus === "INACTIVE") {
      // Leaving Inactive lifts the archive that Inactive set. A status change
      // never lifts an archive made by the admin-only Archive action; Restore
      // does (and so does the member's own reactivation).
      statusDrivenArchivedAt = null;
    }
  }

  const updateData: Record<string, unknown> = {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(phone !== undefined && { phone }),
    ...(emailIsChanging && { email: newEmail }),
    ...(roles !== undefined && { roles }),
    // Extended profile
    ...(preferredName !== undefined && { preferredName }),
    ...(title !== undefined && { title }),
    ...(addressLine1 !== undefined && { addressLine1 }),
    ...(addressCity !== undefined && { addressCity }),
    ...(addressState !== undefined && { addressState }),
    ...(addressZip !== undefined && { addressZip }),
    ...(statusIsChanging && { memberStatus }),
    ...(firstVisitDate !== undefined && {
      firstVisitDate: firstVisitDate ? new Date(firstVisitDate) : null,
    }),
    ...(adminNotes !== undefined && { adminNotes }),
    ...(tags !== undefined && { tags }),
    ...(statusDrivenArchivedAt !== undefined && { archivedAt: statusDrivenArchivedAt }),
  };

  // An email change keeps the old address as a former one, so sign-in still
  // recognizes it and points to the new one (lib/formerEmail.ts).
  let inactiveReleased: { userId: string; hubSlug: string; programSlug: string; sessionDate: Date | null }[] = [];
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        roles: true,
        archivedAt: true,
        createdAt: true,
      },
    });
    // Marked Inactive archives the account: release its schedule as the
    // Archive action does (2026-10-16 audit).
    if (statusDrivenArchivedAt instanceof Date && !user.archivedAt) {
      inactiveReleased = (await releasePersonCoverage(tx, id, session?.user?.id ?? id, { endRotations: true })).rows;
    }
    if (emailIsChanging) {
      // Codes already sent to the old address stop working with it.
      await tx.verificationToken.deleteMany({ where: { identifier: user.email } });
      await releaseFormerEmail(tx, newEmail!);
      await recordFormerEmail(tx, {
        userId: id,
        email: user.email,
        reason: "changed",
        byUserId: session?.user?.id ?? null,
      });
    }
    return row;
  });
  if (inactiveReleased.length) {
    const gaps = await prepareGapNotices(inactiveReleased, [session?.user?.id, id]);
    if (gaps.length) after(() => deliverGapNotices(gaps));
  }

  // Kill sessions when email changes or member is set to Inactive
  if (emailIsChanging || (statusIsChanging && memberStatus === "INACTIVE")) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  // Sync HubMember records whenever roles change
  if (roles !== undefined) {
    await syncHubMembership(id, roles as string[]);
  }

  // Auto-enroll in role-gated series for each newly added role.
  // `after()` keeps this alive past the response — bare `.catch(() => {})`
  // (the pre-2026-05-27 pattern) silently lost work to Vercel's serverless
  // teardown (session 96 lesson).
  if (newlyAddedRoles.length > 0) {
    after(async () => {
      for (const role of newlyAddedRoles) {
        try {
          await enrollMemberInRoleSeries(id, role);
        } catch (err) {
          console.error(
            `[admin/members PATCH] enrollMemberInRoleSeries failed for ${id}/${role}`,
            err,
          );
        }
      }
    });
  }

  // Notify newly-promoted registrar.
  if (addingRegistrar) {
    after(async () => {
      try {
        await sendRoleAssignmentEmail({
          to: updated.email,
          firstName: updated.firstName,
        });
      } catch (err) {
        console.error("[admin/members PATCH] sendRoleAssignmentEmail failed", err);
      }
    });
  }

  // Notify newly-added host.
  if (addingHost) {
    after(async () => {
      try {
        await sendHostRoleAssignmentEmail({
          to: updated.email,
          firstName: updated.firstName,
        });
      } catch (err) {
        console.error("[admin/members PATCH] sendHostRoleAssignmentEmail failed", err);
      }
    });
  }

  // Notify newly-added host coordinator.
  if (addingHostManager) {
    after(async () => {
      try {
        await sendHostManagerRoleAssignmentEmail({
          to: updated.email,
          firstName: updated.firstName,
        });
      } catch (err) {
        console.error("[admin/members PATCH] sendHostManagerRoleAssignmentEmail failed", err);
      }
    });
  }

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    phone: updated.phone,
    roles: updated.roles,
    archivedAt: updated.archivedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (session?.user?.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { registrations: true, hubThreads2: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user._count.registrations > 0) {
    return NextResponse.json(
      { error: `Member has ${user._count.registrations} registration(s). Archive instead.` },
      { status: 409 }
    );
  }

  // A conversation is deleted with the person who started it, and every reply
  // other members wrote in it goes too (2026-10-19 audit). Archive keeps them.
  if (user._count.hubThreads2 > 0) {
    return NextResponse.json(
      { error: `Member started ${user._count.hubThreads2} team conversation(s), and deleting would remove everyone's replies in them. Archive instead.` },
      { status: 409 }
    );
  }

  // Cascade handles: Account, Session, CourseAccess, HubMember, SubClaim, and
  // the member's own replies (their conversations are refused above).
  // Registration uses SetNull (records preserved, userId cleared).
  // The schedule first (2026-10-16 audit): their upcoming sessions released
  // and rotations ended; rotations they created pass to the admin deleting
  // them (that column can't be empty, so the delete used to fail); their
  // past open sign-up rows go, since a nameless sign-up means nothing.
  const adminId = session!.user.id;
  let releasedRows: { userId: string; hubSlug: string; programSlug: string; sessionDate: Date | null }[] = [];
  await db.$transaction(async (tx) => {
    releasedRows = (await releasePersonCoverage(tx, id, adminId, { endRotations: true })).rows;
    await tx.standingAssignment.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
    const pastSignUps = (await tx.hostAssignment.findMany({
      where: { userId: id, hubSlug: { in: (await tx.hub.findMany({ where: { allowsMultipleAssignments: true }, select: { slug: true } })).map((h) => h.slug) } },
      select: { id: true },
    })).map((a) => a.id);
    if (pastSignUps.length) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: pastSignUps } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: pastSignUps } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: pastSignUps } } });
    }
    await tx.user.delete({ where: { id } });
  });
  const gaps = await prepareGapNotices(releasedRows, [adminId, id]);
  if (gaps.length) after(() => deliverGapNotices(gaps));

  return NextResponse.json({ ok: true });
}
