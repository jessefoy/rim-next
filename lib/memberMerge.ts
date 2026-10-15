import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail, recordFormerEmail, releaseFormerEmail } from "@/lib/formerEmail";

/**
 * Merging two accounts for one person (2026-10-15). Three people on teams had
 * two accounts each; the three merges done by hand that day set the rules
 * this file keeps in one place:
 *
 *   - The account with the history is kept, whichever address it has: every
 *     role, team, hosting date, rotation, teaching link and conversation hangs
 *     off its id. The admin chooses only the address it signs in with.
 *   - Everything the other account holds moves onto it. Where a person can
 *     hold only one of a thing (a team, a household, a course grant, a lesson
 *     note), the kept account's copy wins, except a team, which keeps the
 *     stronger of the two (coordinator over member, active over paused).
 *   - The address not kept becomes a former address (lib/formerEmail.ts), so
 *     signing in with it still finds the person.
 *   - Before the other account is deleted, every table is checked for
 *     anything still pointing at it; if something remains (a table added
 *     later and not listed here), nothing is changed at all.
 */

type Tx = Prisma.TransactionClient;

export type MergeSide = {
  id: string;
  email: string;
  name: string;
  hasSignedIn: boolean;
  isLegacyUnclaimed: boolean;
  archived: boolean;
  roles: string[];
  teams: number;
  registrations: number;
  hostingDates: number;
  rotations: number;
  teaching: number;
  conversations: number;
};

export type MergePreview = {
  sides: [MergeSide, MergeSide];
  /** Null when a rolled-back trial merge completed; otherwise why it can't. */
  blocker: string | null;
  /** The account kept (the one with more history). */
  keepId: string;
  /** The address suggested: the one most recently signed in with. */
  suggestedEmail: string;
};

const sideSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  emailVerified: true,
  isLegacyUnclaimed: true,
  archivedAt: true,
  roles: true,
  teacherProfile: { select: { id: true } },
  sessions: { select: { expires: true }, orderBy: { expires: "desc" }, take: 1 },
  _count: {
    select: {
      hubMemberships: true,
      registrations: true,
      hostAssignments: true,
      standingAssignments: true,
      standingAssignmentsCreated: true,
      programTeachers: true,
      lessonTeachers: true,
      hubThreads2: true,
      hubReplies2: true,
    },
  },
} as const;

type SideRow = Prisma.UserGetPayload<{ select: typeof sideSelect }>;

function historyWeight(u: SideRow): number {
  const c = u._count;
  return (
    u.roles.length * 5 +
    (u.teacherProfile ? 5 : 0) +
    c.hubMemberships * 3 +
    c.registrations +
    c.hostAssignments +
    c.standingAssignments +
    c.standingAssignmentsCreated +
    c.programTeachers * 3 +
    c.lessonTeachers +
    c.hubThreads2 +
    c.hubReplies2
  );
}

function toSide(u: SideRow): MergeSide {
  return {
    id: u.id,
    email: u.email,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
    hasSignedIn: !!u.emailVerified,
    isLegacyUnclaimed: u.isLegacyUnclaimed,
    archived: !!u.archivedAt,
    roles: u.roles,
    teams: u._count.hubMemberships,
    registrations: u._count.registrations,
    hostingDates: u._count.hostAssignments,
    rotations: u._count.standingAssignments,
    teaching: u._count.programTeachers + u._count.lessonTeachers,
    conversations: u._count.hubThreads2 + u._count.hubReplies2,
  };
}

/** Which account is kept: more history, then the older account. */
function chooseKept(a: SideRow, b: SideRow): SideRow {
  const wa = historyWeight(a);
  const wb = historyWeight(b);
  if (wa !== wb) return wa > wb ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
}

export async function previewMerge(idA: string, idB: string, byUserId: string): Promise<MergePreview | null> {
  if (idA === idB) return null;
  const [a, b] = await Promise.all([
    db.user.findUnique({ where: { id: idA }, select: sideSelect }),
    db.user.findUnique({ where: { id: idB }, select: sideSelect }),
  ]);
  if (!a || !b) return null;
  const kept = chooseKept(a, b);
  // The address most recently signed in with is the one the person uses now.
  const lastA = a.sessions[0]?.expires.getTime() ?? 0;
  const lastB = b.sessions[0]?.expires.getTime() ?? 0;
  const suggestedEmail = lastA === lastB ? kept.email : lastA > lastB ? a.email : b.email;
  // Prove the merge can complete: run it all, then roll it back.
  let blocker: string | null = null;
  try {
    await mergeAccounts({ idA, idB, email: suggestedEmail, byUserId, dryRun: true });
  } catch (err) {
    blocker = err instanceof MergeError ? err.message : "A trial merge failed; nothing was changed.";
    if (!(err instanceof MergeError)) console.error("[memberMerge] trial merge failed", err);
  }
  return { sides: [toSide(a), toSide(b)], keepId: kept.id, suggestedEmail, blocker };
}

// ── The merge ──────────────────────────────────────────────────────────────

/** Tables where a person may hold one row per `keys`: the kept copy wins. */
const ONE_PER: { table: string; column: string; keys: string[] }[] = [
  { table: "household_members", column: "userId", keys: [] },
  { table: "teacher_profiles", column: "userId", keys: [] },
  { table: "course_access", column: "userId", keys: ["courseSlug"] },
  { table: "lesson_teachers", column: "userId", keys: ["lessonId"] },
  { table: "program_teachers", column: "userId", keys: ["programId"] },
  { table: "lesson_progress", column: "userId", keys: ["lessonId"] },
  { table: "series_enrollments", column: "userId", keys: ["courseId"] },
  { table: "lesson_notes", column: "userId", keys: ["lessonId"] },
  { table: "user_tool_access", column: "userId", keys: ["toolSlug"] },
  { table: "hub_thread_subscriptions", column: "userId", keys: ["threadId"] },
  { table: "google_file_preferences", column: "userId", keys: ["placeKey", "googleFileId"] },
  { table: "google_file_view_preferences", column: "userId", keys: ["placeKey"] },
];

/** Columns that simply point at a person: they all move to the kept account. */
const POINTERS: { table: string; column: string }[] = [
  { table: "Account", column: "userId" },
  { table: "registrations", column: "userId" },
  { table: "donations", column: "userId" },
  { table: "host_assignments", column: "userId" },
  { table: "sub_claims", column: "claimedById" },
  { table: "standing_assignments", column: "userId" },
  { table: "standing_assignments", column: "createdById" },
  { table: "user_tool_access", column: "grantedById" },
  { table: "hub_members", column: "pausedById" },
  { table: "hub_conversation_threads", column: "authorId" },
  { table: "hub_conversation_threads", column: "archivedById" },
  { table: "hub_conversation_threads", column: "deletedById" },
  { table: "hub_conversation_replies", column: "authorId" },
  { table: "email_templates", column: "updatedById" },
  { table: "session_bans", column: "bannedById" },
  { table: "session_chat_messages", column: "fromUserId" },
  { table: "google_file_audit", column: "userId" },
  { table: "google_file_transfers", column: "userId" },
  { table: "google_file_meta", column: "creatorUserId" },
  { table: "google_file_meta", column: "pendingDeleteById" },
  { table: "google_file_pins", column: "pinnedByUserId" },
  { table: "file_comments", column: "authorId" },
  { table: "form_submissions", column: "userId" },
  { table: "former_emails", column: "userId" },
  { table: "former_emails", column: "createdById" },
  { table: "host_assignments", column: "assignedBy" },
  { table: "course_access", column: "grantedBy" },
  // A member's ban from a session room is kept by id (guests by name).
  { table: "session_bans", column: "identity" },
];

/** Reactions are { "👍": [userId, …] } lists: the person appears once, as the kept account. */
const REACTION_TABLES = ["hub_conversation_replies", "file_comments"];

const STATUS_RANK: Record<string, number> = { ACTIVE: 2, PAUSED: 1, INACTIVE: 0 };

async function mergeTeams(tx: Tx, keepId: string, dropId: string) {
  const [keepRows, dropRows] = await Promise.all([
    tx.hubMember.findMany({ where: { userId: keepId } }),
    tx.hubMember.findMany({ where: { userId: dropId } }),
  ]);
  for (const d of dropRows) {
    const k = keepRows.find((r) => r.hubId === d.hubId);
    if (!k) {
      await tx.hubMember.update({ where: { id: d.id }, data: { userId: keepId } });
      continue;
    }
    // Both were on this team: keep the stronger membership, then drop the copy.
    // A coordinator's choices (can host, gets notices, paused) come whole from
    // the stronger row, never OR-ed: a deliberate "off" must not be undone by
    // a stale copy that still has the default.
    const dropStronger = (STATUS_RANK[d.status] ?? 0) > (STATUS_RANK[k.status] ?? 0);
    const strong = dropStronger ? d : k;
    await tx.hubMember.update({
      where: { id: k.id },
      data: {
        isCoordinator: k.isCoordinator || d.isCoordinator,
        position: k.position || d.position,
        status: strong.status,
        pausedAt: strong.pausedAt,
        pausedById: strong.pausedById,
        pauseNote: strong.pauseNote,
        hostingCapability: strong.hostingCapability,
        communicationsEnabled: strong.communicationsEnabled,
        joinedAt: d.joinedAt < k.joinedAt ? d.joinedAt : k.joinedAt,
        coordinatorNote: k.coordinatorNote || d.coordinatorNote,
        firstVisitedAt: earliest(k.firstVisitedAt, d.firstVisitedAt),
        lastVisitedAt: latest(k.lastVisitedAt, d.lastVisitedAt),
      },
    });
    await tx.hubMember.delete({ where: { id: d.id } });
  }
}

const REGISTRATION_RANK: Record<string, number> = { REGISTERED: 4, APPROVED: 3, WAITLISTED: 2, PENDING_PAYMENT: 1 };

/**
 * After the move, one person may hold two live registrations for one program
 * (registered under both addresses). Keep the strongest; the other becomes
 * Cancelled, so its history (and any gift) stays on record. Two claims on
 * the same hosting slot keep one (one that a sub request points at stays).
 */
async function settleDoubles(tx: Tx, keepId: string) {
  const regs = await tx.registration.findMany({
    where: { userId: keepId, status: { not: "CANCELLED" } },
    select: { id: true, programSlug: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  const best = new Map<string, { id: string; rank: number }>();
  const extra: string[] = [];
  for (const r of regs) {
    const rank = REGISTRATION_RANK[r.status] ?? 0;
    const held = best.get(r.programSlug);
    if (!held) best.set(r.programSlug, { id: r.id, rank });
    else if (rank > held.rank) {
      extra.push(held.id);
      best.set(r.programSlug, { id: r.id, rank });
    } else extra.push(r.id);
  }
  if (extra.length) {
    await tx.registration.updateMany({ where: { id: { in: extra } }, data: { status: "CANCELLED" } });
  }
  await tx.$executeRawUnsafe(
    `DELETE FROM "host_assignments" a USING "host_assignments" b
     WHERE a."userId" = $1 AND b."userId" = $1 AND a."id" > b."id"
       AND a."programSlug" = b."programSlug" AND a."hubSlug" = b."hubSlug"
       AND a."sessionDate" IS NOT DISTINCT FROM b."sessionDate"
       AND NOT EXISTS (SELECT 1 FROM "sub_requests" s WHERE s."assignmentId" = a."id")`,
    keepId,
  );
}

/**
 * A public teacher page belongs to whichever profile is public: if only the
 * other account's profile is public, it replaces the kept account's before
 * the one-per move (which otherwise keeps the kept account's copy).
 */
async function preferPublicTeacherProfile(tx: Tx, keepId: string, dropId: string) {
  const [k, d] = await Promise.all([
    tx.teacherProfile.findUnique({ where: { userId: keepId }, select: { id: true, isPublic: true } }),
    tx.teacherProfile.findUnique({ where: { userId: dropId }, select: { id: true, isPublic: true } }),
  ]);
  if (k && d && d.isPublic && !k.isPublic) await tx.teacherProfile.delete({ where: { id: k.id } });
}

/** A household the other account was primary in keeps a primary member. */
async function keepHouseholdPrimary(tx: Tx, dropId: string): Promise<string | null> {
  const row = await tx.householdMember.findUnique({ where: { userId: dropId }, select: { householdId: true, isPrimary: true } });
  return row?.isPrimary ? row.householdId : null;
}

async function restoreHouseholdPrimary(tx: Tx, householdId: string | null) {
  if (!householdId) return;
  const members = await tx.householdMember.findMany({ where: { householdId }, orderBy: { createdAt: "asc" }, select: { id: true, isPrimary: true } });
  if (members.length && !members.some((m) => m.isPrimary)) {
    await tx.householdMember.update({ where: { id: members[0].id }, data: { isPrimary: true } });
  }
}

async function moveOnePer(tx: Tx, keepId: string, dropId: string) {
  for (const { table, column, keys } of ONE_PER) {
    const match = keys.length
      ? `AND (${keys.map((k) => `"${k}"`).join(", ")}) IN (SELECT ${keys.map((k) => `"${k}"`).join(", ")} FROM "${table}" WHERE "${column}" = $2)`
      : `AND EXISTS (SELECT 1 FROM "${table}" WHERE "${column}" = $2)`;
    await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "${column}" = $1 ${match}`, dropId, keepId);
    await tx.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $2 WHERE "${column}" = $1`, dropId, keepId);
  }
}

async function movePointers(tx: Tx, keepId: string, dropId: string) {
  for (const { table, column } of POINTERS) {
    await tx.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $2 WHERE "${column}" = $1`, dropId, keepId);
  }
}

async function moveReactions(tx: Tx, keepId: string, dropId: string) {
  for (const table of REACTION_TABLES) {
    const rows = await tx.$queryRawUnsafe<{ id: string; reactions: Record<string, unknown> }[]>(
      `SELECT "id", "reactions" FROM "${table}" WHERE "reactions"::text LIKE $1`,
      `%${dropId}%`,
    );
    for (const row of rows) {
      const next: Record<string, string[]> = {};
      for (const [emoji, ids] of Object.entries(row.reactions ?? {})) {
        if (!Array.isArray(ids)) continue;
        next[emoji] = [...new Set(ids.map((x) => (x === dropId ? keepId : String(x))))];
      }
      await tx.$executeRawUnsafe(`UPDATE "${table}" SET "reactions" = $2::jsonb WHERE "id" = $1`, row.id, JSON.stringify(next));
    }
  }
}

/** Anything still pointing at the account about to be deleted, by table. */
async function leftovers(tx: Tx, dropId: string): Promise<string[]> {
  const fks = await tx.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users' AND ccu.column_name = 'id'`);
  const named = await tx.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
      AND (column_name ILIKE '%userid' OR column_name ILIKE '%byid' OR column_name ILIKE '%authorid'
           OR column_name ILIKE '%by' OR column_name ILIKE '%identity')
      AND table_name <> 'users'`);
  const seen = new Set<string>();
  const checks: string[] = [];
  for (const { table_name, column_name } of [...fks, ...named]) {
    const key = `${table_name}.${column_name}`;
    // Not RIM accounts or not live: the Zoom seat id is a Zoom user, the
    // retired LiveKit chat's identities are history, and sessions are ended.
    if (
      seen.has(key) ||
      key === "session_meetings.seatUserId" ||
      key === "session_chat_messages.fromIdentity" ||
      table_name === "Session"
    ) continue;
    seen.add(key);
    checks.push(`SELECT '${key}' AS k, count(*)::int AS n FROM "${table_name}" WHERE "${column_name}" = $1`);
  }
  // One query for every column, not one round trip each.
  const rows = checks.length
    ? await tx.$queryRawUnsafe<{ k: string; n: number }[]>(checks.join(" UNION ALL "), dropId)
    : [];
  const found = rows.filter((r) => r.n > 0).map((r) => `${r.k} (${r.n})`);
  return found;
}

const firstOf = <T,>(...values: (T | null | undefined)[]) => values.find((v) => v !== null && v !== undefined && v !== "") ?? null;
const earliest = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : a ?? b);
const latest = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : a ?? b);

export type MergeResult = {
  keptId: string;
  email: string;
  formerEmail: string;
  firstName: string | null;
  /** False when the kept account is archived or still unclaimed: no email then. */
  notify: boolean;
};

/** Thrown at the end of a dry run so the transaction rolls back. */
class DryRunDone extends Error {
  constructor(readonly result: MergeResult) {
    super("dry run");
  }
}

/**
 * Merge two accounts in one transaction. `email` is the address the person
 * signs in with afterwards; it must be one of the two. With `dryRun`, every
 * step runs and is then rolled back: the preview uses it to prove the merge
 * can complete (nothing left behind) before anyone presses the button.
 */
export async function mergeAccounts(args: {
  idA: string;
  idB: string;
  email: string;
  byUserId: string;
  dryRun?: boolean;
}): Promise<MergeResult> {
  try {
    return await runMerge(args);
  } catch (err) {
    if (err instanceof DryRunDone) return err.result;
    throw err;
  }
}

async function runMerge(args: { idA: string; idB: string; email: string; byUserId: string; dryRun?: boolean }) {
  const email = normalizeEmail(args.email);
  return db.$transaction(
    async (tx) => {
      // Hold both rows for the whole merge.
      await tx.$queryRawUnsafe(`SELECT "id" FROM "users" WHERE "id" IN ($1, $2) FOR UPDATE`, args.idA, args.idB);
      const [a, b] = await Promise.all([
        tx.user.findUnique({ where: { id: args.idA }, select: sideSelect }),
        tx.user.findUnique({ where: { id: args.idB }, select: sideSelect }),
      ]);
      if (!a || !b || a.id === b.id) throw new MergeError("One of these accounts no longer exists.");
      if (email !== normalizeEmail(a.email) && email !== normalizeEmail(b.email)) {
        throw new MergeError("Choose one of the two accounts' addresses.");
      }
      const keepRow = chooseKept(a, b);
      const keepId = keepRow.id;
      const dropId = keepRow.id === a.id ? b.id : a.id;
      const [keep, drop] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: keepId } }),
        tx.user.findUniqueOrThrow({ where: { id: dropId } }),
      ]);
      const keepEmail = normalizeEmail(keep.email);
      const dropEmail = normalizeEmail(drop.email);
      const formerEmail = email === keepEmail ? dropEmail : keepEmail;

      if (args.byUserId === dropId) {
        throw new MergeError(
          "This would remove the account you're signed in with. Sign in with the other account to merge these two.",
        );
      }
      // Older admin notes are stored in a format that can't be joined to
      // another account's; rather than lose them, stop.
      const hasNotes = (n: unknown) => n !== null && n !== undefined && !(typeof n === "string" && n.trim() === "");
      if (hasNotes(keep.adminNotes) && hasNotes(drop.adminNotes) && !(typeof keep.adminNotes === "string" && typeof drop.adminNotes === "string")) {
        throw new MergeError(
          "Both accounts have admin notes in an older format. Copy the other account's notes into this one by hand, clear them there, then merge.",
        );
      }

      const formerPrimaryHousehold = await keepHouseholdPrimary(tx, dropId);
      await mergeTeams(tx, keepId, dropId);
      await preferPublicTeacherProfile(tx, keepId, dropId);
      await moveOnePer(tx, keepId, dropId);
      await movePointers(tx, keepId, dropId);
      await moveReactions(tx, keepId, dropId);
      await settleDoubles(tx, keepId);

      // Sign-ins: the other account's end; the kept one's too if its address changes.
      await tx.session.deleteMany({ where: { userId: dropId } });
      if (email !== keepEmail) await tx.session.deleteMany({ where: { userId: keepId } });
      await tx.verificationToken.deleteMany({ where: { identifier: { in: [dropEmail, formerEmail] } } });

      const remaining = await leftovers(tx, dropId);
      if (remaining.length) {
        throw new MergeError(
          `Nothing was changed: the other account still has records this merge doesn't know how to move (${remaining.join(", ")}).`,
        );
      }

      const notes =
        typeof keep.adminNotes === "string" && typeof drop.adminNotes === "string" && keep.adminNotes && drop.adminNotes
          ? `${keep.adminNotes}<p>From the merged account (${drop.email}):</p>${drop.adminNotes}`
          : keep.adminNotes ?? drop.adminNotes;
      const activity =
        keep.legacyActivityCount === null && drop.legacyActivityCount === null
          ? null
          : (keep.legacyActivityCount ?? 0) + (drop.legacyActivityCount ?? 0);

      await tx.user.delete({ where: { id: dropId } });
      await tx.user.update({
        where: { id: keepId },
        data: {
          email,
          firstName: firstOf(keep.firstName, drop.firstName),
          lastName: firstOf(keep.lastName, drop.lastName),
          preferredName: firstOf(keep.preferredName, drop.preferredName),
          title: firstOf(keep.title, drop.title),
          phone: firstOf(keep.phone, drop.phone),
          addressLine1: firstOf(keep.addressLine1, drop.addressLine1),
          addressCity: firstOf(keep.addressCity, drop.addressCity),
          addressState: firstOf(keep.addressState, drop.addressState),
          addressZip: firstOf(keep.addressZip, drop.addressZip),
          avatarUrl: firstOf(keep.avatarUrl, drop.avatarUrl),
          bio: (keep.bio ?? drop.bio ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          adminNotes: (notes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          roles: [...new Set([...keep.roles, ...drop.roles])],
          tags: [...new Set([...keep.tags, ...drop.tags])],
          sectionGrants: [...new Set([...keep.sectionGrants, ...drop.sectionGrants])],
          isTeacher: keep.isTeacher || drop.isTeacher,
          memberStatus: keep.memberStatus === "ACTIVE" || drop.memberStatus === "ACTIVE" ? "ACTIVE" : keep.memberStatus,
          archivedAt: keep.archivedAt && drop.archivedAt ? keep.archivedAt : null,
          isLegacyUnclaimed: keep.isLegacyUnclaimed && drop.isLegacyUnclaimed,
          agreedToTerms: keep.agreedToTerms || drop.agreedToTerms,
          agreedAt: earliest(keep.agreedAt, drop.agreedAt),
          emailVerified: earliest(keep.emailVerified, drop.emailVerified),
          flodeskMemberAt: earliest(keep.flodeskMemberAt, drop.flodeskMemberAt),
          hostWelcomeSeenAt: earliest(keep.hostWelcomeSeenAt, drop.hostWelcomeSeenAt),
          firstVisitDate: earliest(keep.firstVisitDate, drop.firstVisitDate),
          createdAt: earliest(keep.createdAt, drop.createdAt) ?? keep.createdAt,
          legacyMemberSince: earliest(keep.legacyMemberSince, drop.legacyMemberSince),
          legacyLastLogin: latest(keep.legacyLastLogin, drop.legacyLastLogin),
          legacyLastAttendance: latest(keep.legacyLastAttendance, drop.legacyLastAttendance),
          legacyActivityCount: activity,
        },
      });
      await restoreHouseholdPrimary(tx, formerPrimaryHousehold);
      await releaseFormerEmail(tx, email);
      if (formerEmail !== email) {
        await recordFormerEmail(tx, { userId: keepId, email: formerEmail, reason: "merged", byUserId: args.byUserId });
      }

      const stillArchived = !!(keep.archivedAt && drop.archivedAt);
      const stillUnclaimed = keep.isLegacyUnclaimed && drop.isLegacyUnclaimed;
      const result = {
        keptId: keepId,
        email,
        formerEmail,
        firstName: firstOf(keep.firstName, drop.firstName),
        notify: !stillArchived && !stillUnclaimed,
      };
      if (args.dryRun) throw new DryRunDone(result);
      return result;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/** A refusal with words an admin can act on. */
export class MergeError extends Error {}
