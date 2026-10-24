/**
 * Places taken in a program (2026-10-24): registered (APPROVED counts as
 * registered), and a place held while someone pays online. The one count
 * for the public registration form, Add a person, the Registration app's
 * settings and the program editor's Capacity, so they never disagree.
 */

import { db } from "@/lib/db";

export const PLACE_TAKING_STATUSES = ["REGISTERED", "APPROVED", "PENDING_PAYMENT"] as const;

export function countPlacesTaken(programId: string): Promise<number> {
  return db.registration.count({
    where: { programId, status: { in: [...PLACE_TAKING_STATUSES] } },
  });
}
