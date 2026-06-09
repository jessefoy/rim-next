import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Legacy Memberstack → RIM quiet-pool import (the one-time migration).
 *
 * This module is the single source of truth for both parsing the export and
 * writing the records. It's used by the one-time admin import tool
 * (/admin/import-legacy + /api/admin/import-legacy), which runs on Vercel where
 * the database is reachable. Remove this module and that tool once the
 * migration is complete.
 */

export type NormalizedLegacyMember = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  legacyMemberSince: Date | null;
  legacyLastLogin: Date | null;
  legacyLastAttendance: Date | null;
  legacyActivityCount: number | null;
};

/** Handles YYYY-MM-DD (Last Attendance) and M/D/YYYY (CreatedAt, Last Login). */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  return null;
}

function parseCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Memberstack CSV export into normalized member records. This is the
 * ONLY format-aware code — adapt the column indices here for a different export.
 * Expected columns (2026-06-09 export):
 *   First Name, Last Name, email, Phone Number, CreatedAt, Last Login,
 *   Last Attendance Date, Member ID, Activity Count
 * The file is plain (no quoted fields / embedded commas — verified), so a
 * split(",") is safe; a row with fewer than 9 fields or a bad email is skipped
 * with a warning rather than guessed at.
 */
export function parseMemberstackCsv(text: string): {
  records: NormalizedLegacyMember[];
  warnings: string[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const warnings: string[] = [];
  const records: NormalizedLegacyMember[] = [];
  const seen = new Set<string>();
  // lines[0] is the header row.
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(",");
    if (f.length < 9) {
      warnings.push(`line ${i + 1}: only ${f.length} fields, skipped`);
      continue;
    }
    const email = (f[2] || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push(`line ${i + 1}: missing/invalid email, skipped`);
      continue;
    }
    if (seen.has(email)) {
      warnings.push(`line ${i + 1}: duplicate email ${email}, skipped`);
      continue;
    }
    seen.add(email);
    records.push({
      email,
      firstName: (f[0] || "").trim() || null,
      lastName: (f[1] || "").trim() || null,
      phone: (f[3] || "").trim() || null,
      legacyMemberSince: parseDate(f[4]),
      legacyLastLogin: parseDate(f[5]),
      legacyLastAttendance: parseDate(f[6]),
      // f[7] = Memberstack Member ID — intentionally not stored (email is the
      // join key; legacyMemberstackId was removed in session 100).
      legacyActivityCount: parseCount(f[8]),
    });
  }
  return { records, warnings };
}

export type LegacyImportResult = {
  created: number;
  updated: number;
  claimedCollisions: number;
};

/**
 * Import normalized records into the quiet pool. Idempotent (keyed on email).
 *
 * CREATE-ONLY MARKING: isLegacyUnclaimed / agreedToTerms / emailVerified are set
 * only on create — a re-run never un-promotes or re-hides a member who has
 * already logged in. A collision with an already-claimed account (agreedToTerms
 * or a role) refreshes ONLY their legacy* history, never their live
 * name/phone/consent/marker.
 *
 * The common first-run case (the pool is empty → almost everyone is new) is one
 * bulk createMany, so it completes well within the serverless time budget;
 * only genuine collisions with existing accounts fall to per-row updates.
 *
 * With dryRun, classifies create vs update vs claimed-collision against the live
 * database but performs no writes.
 */
export async function importLegacyRecords(
  records: NormalizedLegacyMember[],
  opts: { dryRun?: boolean } = {},
): Promise<LegacyImportResult> {
  const dryRun = opts.dryRun ?? false;

  // Classify against existing rows.
  const existing = new Map<string, { agreedToTerms: boolean; roles: string[] }>();
  const emails = records.map((r) => r.email);
  for (let i = 0; i < emails.length; i += 500) {
    const rows = await db.user.findMany({
      where: { email: { in: emails.slice(i, i + 500) } },
      select: { email: true, agreedToTerms: true, roles: true },
    });
    rows.forEach((u) => existing.set(u.email, { agreedToTerms: u.agreedToTerms, roles: u.roles }));
  }

  const toCreate: Prisma.UserCreateManyInput[] = [];
  const toUpdate: { email: string; isClaimed: boolean; rec: NormalizedLegacyMember }[] = [];
  let claimedCollisions = 0;

  for (const r of records) {
    const prior = existing.get(r.email);
    if (!prior) {
      toCreate.push({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        isLegacyUnclaimed: true,
        legacyMemberSince: r.legacyMemberSince,
        legacyLastLogin: r.legacyLastLogin,
        legacyLastAttendance: r.legacyLastAttendance,
        legacyActivityCount: r.legacyActivityCount,
      });
    } else {
      const isClaimed = prior.agreedToTerms || prior.roles.length > 0;
      if (isClaimed) claimedCollisions++;
      toUpdate.push({ email: r.email, isClaimed, rec: r });
    }
  }

  let created = toCreate.length;

  if (!dryRun) {
    if (toCreate.length) {
      const res = await db.user.createMany({ data: toCreate, skipDuplicates: true });
      created = res.count;
    }
    // Batch the per-row updates with bounded concurrency so even a full re-run
    // — where every row classifies as an update — stays well within the time
    // budget (sequential 1,516 round-trips to Neon could otherwise crawl).
    const CHUNK = 25;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      await Promise.all(
        toUpdate.slice(i, i + CHUNK).map((u) =>
          db.user.update({
            where: { email: u.email },
            // Claimed account → refresh legacy history only (preserve live
            // identity + consent + marker). Unclaimed prior → also refresh
            // name/phone, but never the marker/consent (create-only).
            data: u.isClaimed
              ? {
                  legacyMemberSince: u.rec.legacyMemberSince,
                  legacyLastLogin: u.rec.legacyLastLogin,
                  legacyLastAttendance: u.rec.legacyLastAttendance,
                  legacyActivityCount: u.rec.legacyActivityCount,
                }
              : {
                  firstName: u.rec.firstName,
                  lastName: u.rec.lastName,
                  phone: u.rec.phone,
                  legacyMemberSince: u.rec.legacyMemberSince,
                  legacyLastLogin: u.rec.legacyLastLogin,
                  legacyLastAttendance: u.rec.legacyLastAttendance,
                  legacyActivityCount: u.rec.legacyActivityCount,
                },
          }),
        ),
      );
    }
  }

  return { created, updated: toUpdate.length, claimedCollisions };
}
