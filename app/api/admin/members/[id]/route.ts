import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role, MemberStatus } from "@prisma/client";
import { sendRoleAssignmentEmail, sendHostRoleAssignmentEmail } from "@/lib/email";
import { syncHubMembership } from "@/lib/syncHubMembership";
import { enrollMemberInRoleSeries } from "@/lib/enrollment";

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
    await db.user.update({ where: { id }, data: { archivedAt: new Date() } });
    // Force logout by deleting all active sessions
    await db.session.deleteMany({ where: { userId: id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    await db.user.update({ where: { id }, data: { archivedAt: null } });
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
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const emailIsChanging = newEmail !== undefined && newEmail !== user.email;

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

  // Detect SUPPORT role removal
  const removingSupport =
    roles !== undefined &&
    (user.roles as string[]).includes("SUPPORT") &&
    !(roles as string[]).includes("SUPPORT");

  // Detect newly added roles (for series auto-enrollment)
  const newlyAddedRoles: string[] =
    roles !== undefined
      ? (roles as string[]).filter((r) => !(user.roles as string[]).includes(r))
      : [];

  // Determine archivedAt changes driven by memberStatus
  let statusDrivenArchivedAt: Date | null | undefined;
  if (memberStatus !== undefined) {
    if (memberStatus === "INACTIVE") {
      statusDrivenArchivedAt = new Date();
    } else {
      // Any active-ish status clears the archived flag
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
    ...(memberStatus !== undefined && { memberStatus }),
    ...(firstVisitDate !== undefined && {
      firstVisitDate: firstVisitDate ? new Date(firstVisitDate) : null,
    }),
    ...(adminNotes !== undefined && { adminNotes }),
    ...(tags !== undefined && { tags }),
    ...(statusDrivenArchivedAt !== undefined && { archivedAt: statusDrivenArchivedAt }),
  };

  const updated = await db.user.update({
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

  // Kill sessions when email changes or member is set to Inactive
  if (emailIsChanging || memberStatus === "INACTIVE") {
    await db.session.deleteMany({ where: { userId: id } });
  }

  // Sync HubMember records whenever roles change
  if (roles !== undefined) {
    await syncHubMembership(id, roles as string[]);
  }

  // Auto-enroll in role-gated series for each newly added role — fire-and-forget
  for (const role of newlyAddedRoles) {
    enrollMemberInRoleSeries(id, role).catch(() => {});
  }

  // SUPPORT role revoked: reassign their active threads
  if (removingSupport) {
    // Check for a default assignee
    const defaultSetting = await db.appSetting.findUnique({
      where: { key: "support.defaultAssigneeId" },
    });
    const fallbackId = defaultSetting?.value ?? null;

    // Only reassign if fallback isn't the user being removed
    const reassignTo = fallbackId && fallbackId !== id ? fallbackId : null;

    await db.supportThread.updateMany({
      where: {
        assignedToId: id,
        status: { in: ["OPEN", "CLAIMED", "WAITING"] },
        deletedAt: null,
      },
      data: {
        assignedToId: reassignTo,
        status: reassignTo ? "CLAIMED" : "OPEN",
      },
    });
  }

  // Notify newly-promoted registrar — fire-and-forget
  if (addingRegistrar) {
    sendRoleAssignmentEmail({
      to: updated.email,
      firstName: updated.firstName,
    }).catch(() => {});
  }

  // Notify newly-added host — fire-and-forget
  if (addingHost) {
    sendHostRoleAssignmentEmail({
      to: updated.email,
      firstName: updated.firstName,
    }).catch(() => {});
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
    include: { _count: { select: { registrations: true } } },
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

  // Cascade handles: Account, Session, CourseAccess, UserMembership, AttendanceRecord,
  // HubMember, Alerts, SubClaim, HubConversationThread/Reply, HubDocument.
  // Registration uses SetNull (records preserved, userId cleared).
  // HostAssignment uses SetNull (slot becomes unclaimed).
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
