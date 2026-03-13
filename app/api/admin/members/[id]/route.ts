import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role, MemberStatus } from "@prisma/client";
import { sendRoleAssignmentEmail, sendHostRoleAssignmentEmail } from "@/lib/email";
import { syncHubMembership } from "@/lib/syncHubMembership";

// Revoke a member's Sanity Studio access by email.
// Handles both accepted members and pending invitations.
// Returns separate results for each path plus member emails found (for debugging).
async function revokeSanityAccess(email: string): Promise<{ member: string; invite: string; memberEmails: string[] }> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const token = process.env.SANITY_MANAGEMENT_TOKEN;
  if (!projectId || !token) return { member: "skipped: no token", invite: "skipped", memberEmails: [] };

  const headers = { Authorization: `Bearer ${token}` };
  // Try known Sanity Management API paths for listing project memberships
  const membersPaths = [
    `https://api.sanity.io/v2021-06-07/access/projects/${projectId}/memberships`,
    `https://api.sanity.io/v1/access/projects/${projectId}/memberships`,
  ];
  const invitesBase = `https://api.sanity.io/v2021-10-04/invitations/project/${projectId}`;

  let memberResult = "no match found";
  let inviteResult = "no match found";
  const memberEmails: string[] = [];

  // Remove from project members (accepted invites)
  try {
    let membersRes: Response | null = null;
    let workingMembersBase = "";
    for (const path of membersPaths) {
      const r = await fetch(path, { headers });
      if (r.ok) { membersRes = r; workingMembersBase = path; break; }
      memberResult = `list failed: ${r.status} at ${path}`;
    }
    if (membersRes) {
      const raw = await membersRes.json();
      // Shape varies: [{id, email?, profile?}] or [{userId, role}] depending on endpoint
      const members: { id?: string; userId?: string; email?: string; profile?: { email?: string } }[] =
        Array.isArray(raw) ? raw : (raw.memberships ?? raw.members ?? []);
      // For memberships shape, look up user profile by userId to find email
      let matchId: string | undefined;
      for (const m of members) {
        const memberId = m.id ?? m.userId ?? "";
        const memberEmail = m.profile?.email ?? m.email;
        if (memberEmail) {
          memberEmails.push(memberEmail);
          if (memberEmail === email) matchId = memberId;
        } else if (memberId) {
          // Fetch user profile to get email
          try {
            const profileRes = await fetch(`https://api.sanity.io/v2021-06-07/users/${memberId}`, { headers });
            if (profileRes.ok) {
              const profile: { email?: string } = await profileRes.json();
              const profileEmail = profile.email ?? "(none)";
              memberEmails.push(profileEmail);
              if (profileEmail === email) matchId = memberId;
            }
          } catch { /* ignore */ }
        }
      }
      if (matchId) {
        const del = await fetch(`${workingMembersBase}/${matchId}`, { method: "DELETE", headers });
        memberResult = del.ok ? "removed" : `delete failed: ${del.status}`;
      }
    }
  } catch (e) {
    memberResult = `error: ${String(e)}`;
  }

  // Cancel pending invitations (not yet accepted)
  try {
    const res = await fetch(invitesBase, { headers });
    if (res.ok) {
      const body = await res.json();
      const invites: { id: string; email: string }[] = Array.isArray(body) ? body : (body.invitations ?? []);
      const matching = invites.filter((i) => i.email === email);
      for (const inv of matching) {
        const del = await fetch(`${invitesBase}/${inv.id}`, { method: "DELETE", headers });
        inviteResult = del.ok ? "cancelled" : `delete failed: ${del.status}`;
      }
    }
  } catch { /* ignore */ }

  return { member: memberResult, invite: inviteResult, memberEmails };
}

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
    preferredName, addressLine1, addressCity, addressState, addressZip,
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

  // Detect Sanity revocation: REGISTRAR is being removed AND user had Sanity access
  const removingRegistrar =
    roles !== undefined &&
    user.roles.includes("REGISTRAR") &&
    !(roles as string[]).includes("REGISTRAR");
  const shouldRevokeSanity = removingRegistrar && !!user.sanityInvitedAt;

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
    ...(shouldRevokeSanity && { sanityInvitedAt: null }),
    // Extended profile
    ...(preferredName !== undefined && { preferredName }),
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

  // Revoke Sanity access — blocking so we can surface the result
  let sanityRevokeResult: { member: string; invite: string; memberEmails: string[] } | null = null;
  if (shouldRevokeSanity) {
    sanityRevokeResult = await revokeSanityAccess(user.email);
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
    sanityRevoked: shouldRevokeSanity,
    sanityRevokeResult,
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
  // HubMember, Alerts, SubClaim, HostThread/Reply, HubAnnouncement/Document/Thread/Reply, SessionReport.
  // Registration uses SetNull (records preserved, userId cleared).
  // HostAssignment uses SetNull (slot becomes unclaimed).
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
