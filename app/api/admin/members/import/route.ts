import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

interface ImportRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  memberstackId?: string;
  memberSince?: string;    // ISO string
  lastLogin?: string;      // ISO string
  lastAttendance?: string; // ISO string
  activityCount?: number | null;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { members }: { members: ImportRow[] } = body;

  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of members) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }

    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      // Only fill in blank fields — never overwrite data the member has set themselves
      const patch: Record<string, unknown> = {};
      if (!existing.firstName && row.firstName?.trim())           patch.firstName            = row.firstName.trim();
      if (!existing.lastName  && row.lastName?.trim())            patch.lastName             = row.lastName.trim();
      if (!existing.phone     && row.phone?.trim())               patch.phone                = row.phone.trim();
      if (!existing.legacyMemberstackId && row.memberstackId)     patch.legacyMemberstackId  = row.memberstackId;
      if (!existing.legacyMemberSince   && row.memberSince)       patch.legacyMemberSince    = new Date(row.memberSince);
      if (!existing.legacyLastLogin     && row.lastLogin)         patch.legacyLastLogin      = new Date(row.lastLogin);
      if (!existing.legacyLastAttendance && row.lastAttendance)   patch.legacyLastAttendance = new Date(row.lastAttendance);
      if (existing.legacyActivityCount == null && row.activityCount != null) {
        patch.legacyActivityCount = row.activityCount;
      }

      if (Object.keys(patch).length > 0) {
        await db.user.update({ where: { email }, data: patch });
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.user.create({
        data: {
          email,
          firstName:             row.firstName?.trim()  || null,
          lastName:              row.lastName?.trim()   || null,
          phone:                 row.phone?.trim()      || null,
          legacyMemberstackId:   row.memberstackId      || null,
          legacyMemberSince:     row.memberSince        ? new Date(row.memberSince)    : null,
          legacyLastLogin:       row.lastLogin          ? new Date(row.lastLogin)      : null,
          legacyLastAttendance:  row.lastAttendance     ? new Date(row.lastAttendance) : null,
          legacyActivityCount:   row.activityCount      ?? null,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, skipped });
}
