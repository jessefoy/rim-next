import { after } from "next/server";
import { db } from "@/lib/db";
import { programUsesFlodesk, programSegmentName } from "@/lib/flodeskRules";

export { programUsesFlodesk, programSegmentName };

/**
 * Flodesk — RIM's mass email (2026-10-12, Jesse: "We do most of our bulk email
 * through Flodesk and our transactional emails through our app").
 *
 * The app's only job is to keep two kinds of segment filled:
 *   - Members: every member (Jesse's ruling: every member, said plainly at
 *     /join, unsubscribe in every Flodesk email), added once, at their first
 *     sign-in with a code after accepting the agreements, so the address is
 *     proven theirs: a mistyped or someone else's address typed into /join
 *     never gets mass email. Any onboarding series is a Flodesk workflow
 *     triggered by joining this segment; the app's own welcome letter comes
 *     first and Flodesk never repeats it.
 *   - One segment per registration program, holding its confirmed
 *     registrants (never the waitlist or an unpaid hold), created at the first
 *     registration as "Name MM/DD/YY", or "Name" for an ongoing program.
 *
 * Consent holds: before adding anyone, the subscriber is looked up, and
 * someone Flodesk has as unsubscribed, bounced, complained (anything but
 * active) is left alone. Flodesk's docs don't say whether adding an existing
 * address would resubscribe them, so we never ask it to. This governs mass
 * email only; RIM's transactional email never consults Flodesk.
 *
 * Nothing here may fail a join or a registration: every call is best-effort,
 * logged, and run after the response where a request scope exists.
 */

const API = "https://api.flodesk.com/v1";

/** "Members" in Flodesk (1,135 at 2026-10-12; fed until launch by the Memberstack Zap). */
export const FLODESK_MEMBERS_SEGMENT_ID = "6340dacf92f77615c4cae589";

/** One color for every program segment, so they read as a group in Flodesk. */
const PROGRAM_SEGMENT_COLOR = "#DAA53E";

function apiKey(): string | null {
  return process.env.FLODESK_API_KEY?.trim() || null;
}

async function flodesk(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const key = apiKey();
  if (!key) throw new Error("FLODESK_API_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "RIM-Website/1.0",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  // 100 requests a minute: one patient retry for a burst.
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 3_000));
    return flodesk(path, init, true);
  }
  return res;
}

/** Run Flodesk work after the response when possible, inline otherwise. Never throws. */
export async function inBackground(label: string, work: () => Promise<void>): Promise<void> {
  const safe = async () => {
    try {
      await work();
    } catch (err) {
      console.error(`[flodesk] ${label} failed`, err);
    }
  };
  try {
    after(safe);
  } catch {
    // Outside a request scope (or nested where after() is unavailable).
    await safe();
  }
}

type Person = { email: string; firstName?: string | null; lastName?: string | null };

/**
 * Add a person to segments, honouring their Flodesk status.
 * Returns what happened, for logs.
 */
async function addToSegments(person: Person, segmentIds: string[]): Promise<string> {
  if (!apiKey()) return "skipped: no API key";
  const email = person.email.trim().toLowerCase();
  const id = encodeURIComponent(email);

  const lookup = await flodesk(`/subscribers/${id}`);
  if (lookup.status === 404) {
    const created = await flodesk("/subscribers", {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: (person.firstName ?? "").trim(),
        last_name: (person.lastName ?? "").trim(),
        segment_ids: segmentIds,
        double_optin: false,
      }),
    });
    if (!created.ok) throw new Error(`create subscriber: HTTP ${created.status} ${await created.text().catch(() => "")}`);
    return "created";
  }
  if (!lookup.ok) throw new Error(`look up subscriber: HTTP ${lookup.status}`);

  const subscriber = (await lookup.json()) as { status?: string };
  if (subscriber.status !== "active") return `left alone: ${subscriber.status ?? "unknown status"}`;

  const added = await flodesk(`/subscribers/${id}/segments`, {
    method: "POST",
    body: JSON.stringify({ segment_ids: segmentIds }),
  });
  if (!added.ok) throw new Error(`add to segments: HTTP ${added.status} ${await added.text().catch(() => "")}`);
  return "added";
}

/**
 * A member joins the Members segment, once: called at every sign-in (the
 * code proves the address) and when a signed-in person accepts the
 * agreements. Does nothing until they have agreed, or once it has been done.
 */
export async function addVerifiedMemberToFlodesk(userId: string): Promise<void> {
  await inBackground("add member", async () => {
    if (!apiKey()) return;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, agreedToTerms: true, flodeskMemberAt: true },
    });
    if (!user?.email || !user.agreedToTerms || user.flodeskMemberAt) return;
    const result = await addToSegments(user, [FLODESK_MEMBERS_SEGMENT_ID]);
    // Recorded whether added or left alone (unsubscribed): either way it is done.
    await db.user.update({ where: { id: userId }, data: { flodeskMemberAt: new Date() } });
    console.log(`[flodesk] member ${userId}: ${result}`);
  });
}

// ── Program segments ─────────────────────────────────────────────────────────

const PROGRAM_SELECT = {
  id: true,
  name: true,
  registrationEnabled: true,
  offeringCategory: true,
  flodeskSync: true,
  flodeskSegmentId: true,
  startDatetime: true,
  recurrenceFreq: true,
  recurrenceCount: true,
} as const;

/**
 * The program's segment id, creating it on first need. Serialized per program
 * so two first registrations at once can't create two segments.
 */
async function ensureProgramSegment(programId: string): Promise<string | null> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '15s'`);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"flodesk-segment:" + programId}))`;
      const program = await tx.program.findUnique({ where: { id: programId }, select: PROGRAM_SELECT });
      if (!program) return null;
      if (program.flodeskSegmentId) return program.flodeskSegmentId;

      // A segment with exactly this name is used rather than duplicated: one
      // Jesse already made by hand ("Day of Mindfulness 06/06/26"), or one an
      // earlier attempt created and failed to record.
      const name = programSegmentName(program);
      let segment: { id?: string; name?: string } | undefined = (await listFlodeskSegments()).find(
        (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!segment) {
        const res = await flodesk("/segments", {
          method: "POST",
          body: JSON.stringify({ name, color: PROGRAM_SEGMENT_COLOR }),
        });
        if (!res.ok) throw new Error(`create segment "${name}": HTTP ${res.status} ${await res.text().catch(() => "")}`);
        segment = (await res.json()) as { id?: string; name?: string };
        if (!segment.id) throw new Error(`create segment "${name}": no id returned`);
        // Logged before it is stored, so a failed save can be linked by hand.
        console.log(`[flodesk] created segment ${segment.id} "${segment.name ?? name}" for program ${programId}`);
      } else {
        console.log(`[flodesk] linked existing segment ${segment.id} "${segment.name}" to program ${programId}`);
      }

      await tx.program.update({
        where: { id: programId },
        data: { flodeskSegmentId: segment.id, flodeskSegmentName: segment.name ?? name },
      });
      return segment.id ?? null;
    },
    { timeout: 20_000, maxWait: 20_000 },
  );
}

const CONFIRMED = new Set(["REGISTERED", "APPROVED"]);

/**
 * A registration that is real (REGISTERED / APPROVED) joins its program's
 * segment. Called from the confirmation choke point and from waitlist
 * promotion; safe to call twice (adding to a segment is idempotent).
 */
export async function addRegistrationToFlodesk(registrationId: string): Promise<void> {
  await inBackground("add registrant", async () => {
    if (!apiKey()) return;
    const reg = await db.registration.findUnique({
      where: { id: registrationId },
      select: { email: true, firstName: true, lastName: true, status: true, programId: true },
    });
    if (!reg || !CONFIRMED.has(reg.status) || !reg.programId) return;
    const program = await db.program.findUnique({ where: { id: reg.programId }, select: PROGRAM_SELECT });
    if (!program || !programUsesFlodesk(program)) return;

    const segmentId = program.flodeskSegmentId ?? (await ensureProgramSegment(program.id));
    if (!segmentId) return;
    const result = await addToSegments(reg, [segmentId]);
    console.log(`[flodesk] registrant ${registrationId}: ${result}`);
  });
}

/**
 * A cancelled registration leaves its program's segment (and nothing else),
 * unless the person belongs there through another confirmed registration (a
 * segment can be shared by linking). Only for a registration that was
 * confirmed: a waitlisted or unpaid one was never added.
 */
export async function removeRegistrationFromFlodesk(registrationId: string, previousStatus: string): Promise<void> {
  if (!CONFIRMED.has(previousStatus)) return;
  await inBackground("remove registrant", async () => {
    if (!apiKey()) return;
    const reg = await db.registration.findUnique({
      where: { id: registrationId },
      select: { email: true, program: { select: { flodeskSegmentId: true } } },
    });
    const segmentId = reg?.program?.flodeskSegmentId;
    if (!reg || !segmentId) return;
    const stillThere = await db.registration.count({
      where: {
        id: { not: registrationId },
        email: { equals: reg.email, mode: "insensitive" },
        status: { in: ["REGISTERED", "APPROVED"] },
        program: { flodeskSegmentId: segmentId },
      },
    });
    if (stillThere > 0) return;
    const res = await flodesk(`/subscribers/${encodeURIComponent(reg.email.trim().toLowerCase())}/segments`, {
      method: "DELETE",
      body: JSON.stringify({ segment_ids: [segmentId] }),
    });
    if (res.status === 404) return;
    if (!res.ok) throw new Error(`remove from segment: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    console.log(`[flodesk] registrant ${registrationId}: removed from program segment`);
  });
}

/** Every segment, for the Program Manager's "link an existing segment" picker. */
export async function listFlodeskSegments(): Promise<{ id: string; name: string }[]> {
  if (!apiKey()) return [];
  const out: { id: string; name: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await flodesk(`/segments?per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`list segments: HTTP ${res.status}`);
    const body = (await res.json()) as { data?: { id: string; name: string }[]; meta?: { total_pages?: number } };
    for (const s of body.data ?? []) out.push({ id: s.id, name: s.name });
    if (!body.meta?.total_pages || page >= body.meta.total_pages) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** One segment by id, or null if Flodesk has no such segment. */
export async function getFlodeskSegment(id: string): Promise<{ id: string; name: string } | null> {
  if (!apiKey() || !/^[A-Za-z0-9]{6,64}$/.test(id)) return null;
  const res = await flodesk(`/segments/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get segment: HTTP ${res.status}`);
  const s = (await res.json()) as { id?: string; name?: string };
  return s.id ? { id: s.id, name: s.name ?? "" } : null;
}
