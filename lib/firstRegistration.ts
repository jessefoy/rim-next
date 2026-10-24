/**
 * "First registration here" (Jesse, 2026-10-24): someone with a place in a
 * program whose account or address holds no earlier place on this site.
 * Only a real place counts (registered or approved): a cancelled sign-up or a
 * time on a waiting list isn't having come, so someone who cancelled and
 * signed up again keeps the mark. Said as what the site knows: the old
 * site's history isn't here. Used by the teacher's page, and by the
 * registrar's pages when they show it.
 */

import { db } from "@/lib/db";

export interface PlaceRow {
  id: string;
  userId: string | null;
  email: string;
  createdAt: Date;
}

const same = (a: PlaceRow, b: PlaceRow) =>
  (!!a.userId && a.userId === b.userId) || a.email.trim().toLowerCase() === b.email.trim().toLowerCase();

/** Pure: the ids of `people` with no earlier place among `places`. */
export function firstRegistrationIds(people: PlaceRow[], places: PlaceRow[]): Set<string> {
  return new Set(
    people
      .filter((p) => !places.some((e) => e.id !== p.id && e.createdAt < p.createdAt && same(e, p)))
      .map((p) => p.id),
  );
}

/** The ids of `people` whose place here is their first on this site. */
export async function loadFirstRegistrationIds(people: PlaceRow[]): Promise<Set<string>> {
  if (people.length === 0) return new Set();
  const places = await db.registration.findMany({
    where: {
      status: { in: ["REGISTERED", "APPROVED"] },
      OR: [
        { userId: { in: people.map((p) => p.userId).filter((u): u is string => !!u) } },
        { email: { in: people.map((p) => p.email.trim()), mode: "insensitive" } },
      ],
    },
    select: { id: true, userId: true, email: true, createdAt: true },
  });
  return firstRegistrationIds(people, places);
}
