import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

// Revoke a member's Sanity Studio access by email.
// Handles both accepted members and pending invitations.
// Returns separate results for each path plus member emails found (for debugging).
async function revokeSanityAccess(email: string): Promise<{ member: string; invite: string; memberEmails: string[] }> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const token = process.env.SANITY_MANAGEMENT_TOKEN;
  if (!projectId || !token) return { member: "skipped: no token", invite: "skipped", memberEmails: [] };

  const headers = { Authorization: `Bearer ${token}` };
  const membersBase = `https://api.sanity.io/v2021-10-04/projects/${projectId}`;
  const invitesBase = `https://api.sanity.io/v2021-10-04/invitations/project/${projectId}`;

  let memberResult = "no match found";
  let inviteResult = "no match found";
  const memberEmails: string[] = [];

  // Remove from project members (accepted invites)
  try {
    const res = await fetch(`${membersBase}/members`, { headers });
    if (res.ok) {
      const members: { id: string; email?: string; profile?: { email?: string } }[] = await res.json();
      // Collect all emails so we can debug mismatches
      for (const m of members) memberEmails.push(m.profile?.email ?? m.email ?? "(none)");
      const match = members.find((m) => (m.profile?.email ?? m.email) === email);
      if (match) {
        const del = await fetch(`${membersBase}/members/${match.id}`, { method: "DELETE", headers });
        memberResult = del.ok ? "removed" : `delete failed: ${del.status}`;
      }
    } else {
      memberResult = `list failed: ${res.status}`;
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
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, firstName, lastName, phone, email, roles } = body;

  // ── Special actions ──────────────────────────────────────────────────────────

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

  // Validate roles if provided
  if (roles !== undefined) {
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

  const updateData: Record<string, unknown> = {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(phone !== undefined && { phone }),
    ...(emailIsChanging && { email: newEmail }),
    ...(roles !== undefined && { roles }),
    ...(shouldRevokeSanity && { sanityInvitedAt: null }),
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

  // If email changed, kill all sessions so they must re-authenticate with the new address.
  if (emailIsChanging) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  // Revoke Sanity access — blocking so we can surface the result
  let sanityRevokeResult: { member: string; invite: string; memberEmails: string[] } | null = null;
  if (shouldRevokeSanity) {
    sanityRevokeResult = await revokeSanityAccess(user.email);
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

  // Cascade handles: Account, Session, CourseAccess, UserMembership, AttendanceRecord
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
