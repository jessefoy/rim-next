import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { toProperName } from "@/lib/nameCase";

/**
 * Memberstack → RIM quiet-pool import.
 *
 * Restored 2026-10-13 from the session-145 tool (git 3c543da^) to bring in the
 * members who joined the old site after the June import, and run once more on
 * the day the domain moves. It now reads Memberstack's Admin REST API directly
 * (`MEMBERSTACK_SECRET_KEY`, server-only) instead of an uploaded CSV, so no
 * member file is ever handled or committed.
 *
 * CREATE-ONLY, and only for people who joined Memberstack after the latest
 * join date already imported: anyone already in the app is left exactly as
 * they are, and anyone older who is missing (declined the agreements, or
 * removed by an admin) is never re-created. New people
 * become quiet, unclaimed legacy accounts: hidden from the default registry,
 * sent nothing, exempt from the cleanup cron, promoted when they first sign in
 * and accept the agreements. Suspected bots are left behind and listed for
 * review.
 *
 * Remove this module, /admin/import-legacy and /api/admin/import-legacy after
 * the domain move, and the key from Vercel and Memberstack.
 */

const MEMBERSTACK_API = "https://admin.memberstack.com";
const MAX_PAGES = 200;

/**
 * The session-145 export was taken 2026-06-09. Only a fallback: the real
 * cutoff is the latest join date already imported, so each run brings in only
 * people newer than the last, and anyone removed in between stays removed.
 */
export const JUNE_EXPORT_DATE = new Date("2026-06-09T00:00:00Z");

export type NormalizedLegacyMember = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  legacyMemberSince: Date | null;
  legacyLastLogin: Date | null;
  legacyLastAttendance: Date | null;
  legacyActivityCount: number | null;
  suspectedBot: boolean;
};

type MemberstackMember = {
  createdAt?: string | null;
  lastLogin?: string | null;
  auth?: { email?: string | null } | null;
  customFields?: Record<string, unknown> | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** ISO timestamps and YYYY-MM-DD (last-attendance-date) both parse; anything else is null. */
function parseDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCount(v: unknown): number | null {
  const n = parseInt(str(v), 10);
  return Number.isFinite(n) ? n : null;
}

function cleanName(v: unknown): string | null {
  const s = toProperName(str(v));
  return s || null;
}

/**
 * The rule used to gather Flodesk's "Suspected bots: review" segment
 * (2026-10-13): a name of 12+ letters with 2+ capitals after the first, or a
 * Gmail address with 3+ dots before the @. Apply it to names as typed, before
 * any re-casing.
 */
export function looksLikeBot(firstName: string | null, lastName: string | null, email: string): boolean {
  const botName = (n: string | null) => {
    const s = (n ?? "").trim();
    return /^[A-Za-z]{12,}$/.test(s) && (s.slice(1).match(/[A-Z]/g) ?? []).length >= 2;
  };
  const [local = "", domain = ""] = email.split("@");
  const dottedGmail =
    (domain === "gmail.com" || domain === "googlemail.com") && (local.match(/\./g) ?? []).length >= 3;
  return botName(firstName) || botName(lastName) || dottedGmail;
}

async function fetchPage(url: URL, key: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "X-API-KEY": key },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 429 || attempt === 3) return res;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}

/** Fetch every Memberstack member (100 a page; the API allows 25 requests a second). */
export async function fetchMemberstackMembers(): Promise<{
  records: NormalizedLegacyMember[];
  total: number;
  skippedNoEmail: number;
  duplicates: number;
}> {
  const key = process.env.MEMBERSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("MEMBERSTACK_SECRET_KEY is not set.");

  const raw: MemberstackMember[] = [];
  let after: string | number | undefined;
  let complete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL("/members", MEMBERSTACK_API);
    url.searchParams.set("limit", "100");
    if (after != null) url.searchParams.set("after", String(after));
    const res = await fetchPage(url, key);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Memberstack responded ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: MemberstackMember[];
      hasNextPage?: boolean;
      endCursor?: string | number | null;
    };
    raw.push(...(json.data ?? []));
    if (!json.hasNextPage) {
      complete = true;
      break;
    }
    if (json.endCursor == null || json.endCursor === after) {
      throw new Error("Memberstack's paging stopped moving forward.");
    }
    after = json.endCursor;
  }
  if (!complete) throw new Error(`Memberstack had more than ${MAX_PAGES} pages; nothing was imported.`);

  const records: NormalizedLegacyMember[] = [];
  const seen = new Set<string>();
  let skippedNoEmail = 0;
  let duplicates = 0;
  for (const m of raw) {
    const email = str(m.auth?.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skippedNoEmail++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    const cf = m.customFields ?? {};
    records.push({
      email,
      firstName: cleanName(cf["first-name"]),
      lastName: cleanName(cf["last-name"]),
      phone: str(cf["phone-number"]) || null,
      legacyMemberSince: parseDate(m.createdAt),
      legacyLastLogin: parseDate(m.lastLogin),
      legacyLastAttendance: parseDate(cf["last-attendance-date"]),
      legacyActivityCount: parseCount(cf["activity-count"]),
      suspectedBot: looksLikeBot(str(cf["first-name"]), str(cf["last-name"]), email),
    });
  }
  return { records, total: raw.length, skippedNoEmail, duplicates };
}

export type SkippedPerson = { name: string; email: string; joined: string | null };

export type LegacyImportResult = {
  memberstackTotal: number;
  skippedNoEmail: number;
  duplicates: number;
  alreadyInApp: number;
  /** Only people who joined after this were considered. */
  cutoff: string;
  /** Joined on or before the cutoff and not in the app: never re-created. */
  earlierNotRecreated: number;
  suspectedBots: SkippedPerson[];
  created: number;
  newByMonth: Record<string, number>;
};

/**
 * Compare Memberstack with the app and create the new people. With dryRun,
 * nothing is written. Emails are compared case-insensitively against every
 * account, so a mixed-case address already in the app is never duplicated;
 * skipDuplicates covers a run that overlaps a sign-up or another run.
 */
export async function importFromMemberstack(opts: { dryRun: boolean }): Promise<LegacyImportResult> {
  const { records, total, skippedNoEmail, duplicates } = await fetchMemberstackMembers();

  const latest = await db.user.aggregate({ _max: { legacyMemberSince: true } });
  const cutoff = latest._max.legacyMemberSince ?? JUNE_EXPORT_DATE;

  // Current addresses and former ones (lib/formerEmail.ts): an address an
  // account used to sign in with is never imported as a second account.
  const existing = new Set([
    ...(await db.user.findMany({ select: { email: true } })).map((u) => u.email.trim().toLowerCase()),
    ...(await db.formerEmail.findMany({ select: { email: true } })).map((f) => f.email),
  ]);

  let alreadyInApp = 0;
  let earlierNotRecreated = 0;
  const suspectedBots: SkippedPerson[] = [];
  const newByMonth: Record<string, number> = {};
  const toCreate: Prisma.UserCreateManyInput[] = [];
  for (const r of records) {
    if (existing.has(r.email)) {
      alreadyInApp++;
      continue;
    }
    if (!r.legacyMemberSince || r.legacyMemberSince <= cutoff) {
      earlierNotRecreated++;
      continue;
    }
    const joined = r.legacyMemberSince.toISOString().slice(0, 10);
    if (r.suspectedBot) {
      suspectedBots.push({ name: [r.firstName, r.lastName].filter(Boolean).join(" "), email: r.email, joined });
      continue;
    }
    const month = joined.slice(0, 7);
    newByMonth[month] = (newByMonth[month] ?? 0) + 1;
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
  }

  let created = toCreate.length;
  if (!opts.dryRun && toCreate.length) {
    const res = await db.user.createMany({ data: toCreate, skipDuplicates: true });
    created = res.count;
  }

  return {
    memberstackTotal: total,
    skippedNoEmail,
    duplicates,
    alreadyInApp,
    cutoff: cutoff.toISOString(),
    earlierNotRecreated,
    suspectedBots,
    created,
    newByMonth,
  };
}
