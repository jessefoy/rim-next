import { db } from "@/lib/db";

/**
 * ─── MIND-MAP ACCESS ──────────────────────────────────────────────────────
 * Mirrors lib/documentAuth.ts. A MindMap is RIM's second portable resource:
 * an origin hub (`hubId`, nullable for standalone "project" maps) plus, from
 * Slice 2, placements into additional hubs. Access layers a per-map
 * `visibility` on top of that placement set:
 *
 *   HUB          — any member of any hub the map is placed in
 *   COORDINATORS — only coordinators of those hubs
 *   COMMUNITY    — any active member, hub-independent
 *
 * The author always reaches their own map; GUIDING_TEACHER reaches every map
 * (sangha-wide dharma authority). ADMIN-alone does NOT — it participates as a
 * member (the session-128 boundary; see lib/hubAuth / lib/documentAuth).
 *
 * SLICE 1 NOTE: there is no placement table yet, so callers pass
 * `placements: []`. With no hubId + no placements, a map resolves to
 * author-or-GT only — exactly the "private until placed" behavior we want.
 * The hub/placement branches are live now so Slice 2 needs no rewrite.
 *
 * These functions are PURE: load the map + the viewer's memberships once, then
 * filter in memory. `canUserAccessMindMap` is the async single-map wrapper.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type MindMapVisibility = "HUB" | "COORDINATORS" | "COMMUNITY";

/** The map fields access depends on. */
export interface MindMapAccessShape {
  addedById: string;
  hubId: string | null;
  visibility: string;
  placements: { hubId: string }[];
}

/** The viewer's identity + their hub memberships (hubId + coordinator flag). */
export interface MindMapViewer {
  userId: string;
  roles: string[];
  memberships: { hubId: string; isCoordinator: boolean }[];
}

/** The set of hubs a map lives in: origin hub + every placement. */
function mindMapHubIds(map: MindMapAccessShape): Set<string> {
  const ids = new Set<string>();
  if (map.hubId) ids.add(map.hubId);
  for (const p of map.placements) ids.add(p.hubId);
  return ids;
}

/** Can this viewer OPEN this map? The canonical access door. Pure. */
export function canAccessMindMap(map: MindMapAccessShape, viewer: MindMapViewer): boolean {
  if (map.addedById === viewer.userId) return true; // author always
  if (viewer.roles.includes("GUIDING_TEACHER")) return true; // sangha-wide reach
  if (map.visibility === "COMMUNITY") return true; // every active member

  const hubIds = mindMapHubIds(map);
  for (const m of viewer.memberships) {
    if (!hubIds.has(m.hubId)) continue;
    if (map.visibility === "HUB") return true;
    if (map.visibility === "COORDINATORS" && m.isCoordinator) return true;
  }
  return false;
}

/**
 * Can this viewer EDIT this map (its nodes/structure)? Author, or a coordinator
 * of any hub the map is placed in (GUIDING_TEACHER acts as coordinator
 * everywhere). Role-driven; ignores `visibility` (a COMMUNITY map is
 * community-readable, never community-editable).
 */
export function canEditMindMap(map: MindMapAccessShape, viewer: MindMapViewer): boolean {
  if (map.addedById === viewer.userId) return true;
  if (viewer.roles.includes("GUIDING_TEACHER")) return true;

  const hubIds = mindMapHubIds(map);
  for (const m of viewer.memberships) {
    if (hubIds.has(m.hubId) && m.isCoordinator) return true;
  }
  return false;
}

/**
 * Can this viewer manage the map's SHARING LIFECYCLE (visibility, share-out)?
 * Origin owns it: author, a coordinator of the ORIGIN hub, or GUIDING_TEACHER.
 * A shared-into hub's coordinator does NOT qualify — their only action is
 * removing their own hub's placement (`canRemovePlacement`). (Used from Slice 2.)
 */
export function canManageMindMapSharing(map: MindMapAccessShape, viewer: MindMapViewer): boolean {
  if (map.addedById === viewer.userId) return true;
  if (viewer.roles.includes("GUIDING_TEACHER")) return true;
  if (map.hubId === null) return false; // standalone project map: author / GT only
  return viewer.memberships.some((m) => m.hubId === map.hubId && m.isCoordinator);
}

/**
 * Can this viewer remove the map's placement in `hubId`? The origin side can
 * remove any placement; additionally a coordinator of the specific hub being
 * removed can drop that hub's placement (a team declining a shared map).
 * (Used from Slice 2.)
 */
export function canRemoveMindMapPlacement(map: MindMapAccessShape, viewer: MindMapViewer, hubId: string): boolean {
  if (canManageMindMapSharing(map, viewer)) return true;
  return viewer.memberships.some((m) => m.hubId === hubId && m.isCoordinator);
}

/**
 * Async single-map gate: loads the map's access shape + the viewer's
 * memberships, delegates to `canAccessMindMap`. Returns null if the map doesn't
 * exist or is trashed (caller maps to 404).
 */
export async function canUserAccessMindMap(
  mapId: string,
  userId: string,
  roles: string[],
): Promise<boolean | null> {
  const map = await db.mindMap.findUnique({
    where: { id: mapId },
    select: { addedById: true, hubId: true, visibility: true, deletedAt: true },
  });
  if (!map || map.deletedAt) return null;

  const memberships = await db.hubMember.findMany({
    where: { userId },
    select: { hubId: true, isCoordinator: true },
  });

  // Slice 1: no placement table yet → placements is always [].
  return canAccessMindMap({ ...map, placements: [] }, { userId, roles, memberships });
}
