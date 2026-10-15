import { db } from "@/lib/db";

/**
 * Possible second accounts for one person (2026-10-15). Three people on teams
 * had two accounts each (a personal address and an unclaimed import at their
 * RIM address), and signing in with the wrong one showed no teams. The
 * registry flags them so an admin sees the pair before adding teams, and can
 * merge them.
 *
 * Two accounts may be the same person when they share a first and last name,
 * or a phone number (the last ten digits, however it was typed). A shared
 * phone alone is not enough inside one household (spouses often share one),
 * nor when more than three accounts carry it (an office line or a
 * placeholder), and a number of one repeated digit is ignored.
 * Every account is compared, the quiet import pool included, because that is
 * where the second account usually waits.
 */

export type DuplicateCandidate = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isLegacyUnclaimed: boolean;
  archived: boolean;
  hasSignedIn: boolean;
  roles: string[];
  teamCount: number;
  registrationCount: number;
  matchedOn: ("name" | "phone")[];
};

type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  householdId: string | null;
};

export function nameKey(firstName: string | null, lastName: string | null): string | null {
  const first = firstName?.trim().toLowerCase();
  const last = lastName?.trim().toLowerCase();
  return first && last ? `${first} ${last}` : null;
}

export function phoneKey(phone: string | null): string | null {
  // Drop an extension ("x12", "ext. 12") before taking the last ten digits.
  const digits = (phone ?? "").split(/x|ext/i)[0].replace(/\D/g, "");
  if (digits.length < 10) return null;
  const key = digits.slice(-10);
  return /^(\d)\1+$/.test(key) ? null : key;
}

// A phone shared by more than this many accounts is a shared line, not a person.
const MAX_SHARED_PHONE = 3;

function phoneCounts(people: Person[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of people) {
    const k = phoneKey(p.phone);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function matchesBetween(a: Person, b: Person, phones: Map<string, number>): ("name" | "phone")[] {
  const on: ("name" | "phone")[] = [];
  const an = nameKey(a.firstName, a.lastName);
  if (an && an === nameKey(b.firstName, b.lastName)) on.push("name");
  const ap = phoneKey(a.phone);
  const sameHousehold = !!a.householdId && a.householdId === b.householdId;
  if (ap && ap === phoneKey(b.phone) && !sameHousehold && (phones.get(ap) ?? 0) <= MAX_SHARED_PHONE) {
    on.push("phone");
  }
  return on;
}

async function everyone(): Promise<Person[]> {
  const users = await db.user.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, household: { select: { householdId: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    householdId: u.household?.householdId ?? null,
  }));
}

/** Ids of every account that has a possible second account. */
export async function accountsWithPossibleDuplicates(): Promise<Set<string>> {
  const people = await everyone();
  const phones = phoneCounts(people);
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const name = nameKey(p.firstName, p.lastName);
    const phone = phoneKey(p.phone);
    for (const k of [name && `name:${name}`, phone && `phone:${phone}`]) {
      if (!k) continue;
      const list = groups.get(k);
      if (list) list.push(p);
      else groups.set(k, [p]);
    }
  }
  const flagged = new Set<string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (const a of list) {
      if (flagged.has(a.id)) continue;
      if (list.some((b) => b.id !== a.id && matchesBetween(a, b, phones).length > 0)) flagged.add(a.id);
    }
  }
  return flagged;
}

/** The accounts that may be the same person as `userId`. */
export async function possibleDuplicatesOf(userId: string): Promise<DuplicateCandidate[]> {
  const people = await everyone();
  const me = people.find((p) => p.id === userId);
  if (!me) return [];
  const phones = phoneCounts(people);
  const matches = people
    .filter((p) => p.id !== userId)
    .map((p) => ({ id: p.id, on: matchesBetween(me, p, phones) }))
    .filter((m) => m.on.length > 0);
  if (matches.length === 0) return [];

  const details = await db.user.findMany({
    where: { id: { in: matches.map((m) => m.id) } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isLegacyUnclaimed: true,
      archivedAt: true,
      emailVerified: true,
      roles: true,
      _count: { select: { hubMemberships: true, registrations: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  });
  const on = new Map(matches.map((m) => [m.id, m.on]));
  return details.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    isLegacyUnclaimed: u.isLegacyUnclaimed,
    archived: !!u.archivedAt,
    hasSignedIn: !!u.emailVerified,
    roles: u.roles,
    teamCount: u._count.hubMemberships,
    registrationCount: u._count.registrations,
    matchedOn: on.get(u.id) ?? [],
  }));
}
