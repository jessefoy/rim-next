/**
 * Hub Membership Authority (Phase 3)
 *
 * Principle: when a HubMember record exists for (userId, hubSlug), that record
 * is authoritative for team state — hosting capability, communications, pause
 * status. The coordinator owns these fields and can restrict them without
 * touching the member's global Role[].
 *
 * Fall-through: if no HubMember record exists, these helpers fall back to the
 * legacy role gate (Role[] check). This preserves backwards compatibility for
 * users who hold a system role but have not yet been synced into the hub.
 */

import { db } from "@/lib/db";

type HubAuthMember = {
  status: "ACTIVE" | "PAUSED" | "INACTIVE";
  hostingCapability: boolean;
  communicationsEnabled: boolean;
};

async function loadHubMember(
  userId: string,
  hubSlug: string
): Promise<HubAuthMember | null> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { id: true },
  });
  if (!hub) return null;

  const member = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
    select: {
      status: true,
      hostingCapability: true,
      communicationsEnabled: true,
    },
  });
  return member;
}

/**
 * Returns true if the user is currently permitted to receive hosting/admin
 * grants (LiveKit roomAdmin, sub-request claims, HostAssignment creation).
 *
 * Authority order:
 *   1. If a HubMember record exists → use it: status === "ACTIVE" AND hostingCapability
 *   2. Else → fall through to the legacy role check provided by the caller
 */
export async function getEffectiveHostingCapability(
  userId: string,
  hubSlug: string,
  fallbackAllowed: boolean = false
): Promise<boolean> {
  const member = await loadHubMember(userId, hubSlug);
  if (member) {
    return member.status === "ACTIVE" && member.hostingCapability;
  }
  return fallbackAllowed;
}

/**
 * Returns true if the user should receive hub notifications (emails + alerts).
 *
 * Authority order:
 *   1. If a HubMember record exists → use it: status === "ACTIVE" AND communicationsEnabled
 *   2. Else → fall through (legacy role-gated recipients continue to receive)
 */
export async function canReceiveHubNotifications(
  userId: string,
  hubSlug: string,
  fallbackAllowed: boolean = true
): Promise<boolean> {
  const member = await loadHubMember(userId, hubSlug);
  if (member) {
    return member.status === "ACTIVE" && member.communicationsEnabled;
  }
  return fallbackAllowed;
}

/**
 * Auto-enroll safety net for the "covers ⇒ member" invariant (session 146).
 *
 * After per-hub Scheduler gating, the only people who can self-claim a session
 * in a hub they're not already a roster member of are the oversight roles
 * (HOST_MANAGER / ADMIN / GUIDING_TEACHER). When one of them does, create a
 * HubMember row so the assignment ledger and the team roster never disagree —
 * otherwise the claimant would show as covering a session but be absent from
 * the member picker (the original "Nancy" symptom).
 *
 * No-op when a row already exists (never touches coordinator-owned state:
 * status, hostingCapability, pause fields). Silent — the caller's "you're
 * hosting / greeting" confirmation is the only notification. Mirrors
 * syncHubMembership's create shape: only sync-owned fields are set, so schema
 * defaults govern status (ACTIVE) / hostingCapability / communicationsEnabled.
 */
export async function ensureActiveHubMembership(
  userId: string,
  hubSlug: string,
  position: string = "Member",
): Promise<void> {
  const hub = await db.hub.findUnique({ where: { slug: hubSlug }, select: { id: true } });
  if (!hub) return;
  await db.hubMember.upsert({
    where: { hubId_userId: { hubId: hub.id, userId } },
    create: { hubId: hub.id, userId, position, isCoordinator: false },
    update: {},
  });
}
