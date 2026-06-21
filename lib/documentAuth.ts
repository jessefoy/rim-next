import { db } from "@/lib/db";

/**
 * ─── DOCUMENT ACCESS ──────────────────────────────────────────────────────
 * Hub documents generalize the "one resource ↔ one hub" model. A HubDocument
 * has an origin hub (`hubId`, nullable for hubless project/community docs) and
 * can be *placed in* additional hubs (HubDocumentPlacement) — one canonical
 * doc, surfaced in many hubs, never duplicated. Access layers a per-doc
 * `visibility` on top of that placement set:
 *
 *   HUB          — any member of any hub the doc is placed in
 *   COORDINATORS — only coordinators of those hubs
 *   COMMUNITY    — any active member, hub-independent
 *
 * The author always reaches their own doc; GUIDING_TEACHER (sangha-wide dharma
 * authority) reaches every doc, mirroring `canAccessHub`. ADMIN-alone does NOT
 * — ADMIN participates as a member (the session-128 boundary; see lib/hubAuth).
 *
 * `canAccessDocument` / `canEditDocument` are PURE: a caller loads the doc
 * (with placements) and the viewer's memberships once, then filters in memory,
 * so a directory listing never issues a query per doc. `canUserAccessDocument`
 * is the async convenience wrapper for a single-doc gate.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type HubDocVisibility = "HUB" | "COORDINATORS" | "COMMUNITY";

/** The doc fields access depends on. Load placements via `{ select: { hubId: true } }`. */
export interface DocumentAccessShape {
  addedById: string;
  hubId: string | null;
  visibility: HubDocVisibility;
  placements: { hubId: string }[];
}

/** The viewer's identity + their hub memberships (hubId + coordinator flag). */
export interface DocumentViewer {
  userId: string;
  roles: string[];
  memberships: { hubId: string; isCoordinator: boolean }[];
}

/** The set of hubs a doc lives in: origin hub + every placement. */
function documentHubIds(doc: DocumentAccessShape): Set<string> {
  const ids = new Set<string>();
  if (doc.hubId) ids.add(doc.hubId);
  for (const p of doc.placements) ids.add(p.hubId);
  return ids;
}

/**
 * Can this viewer OPEN this document? The canonical access door for the doc
 * view, the master directory, and the OnlyOffice editor-config route. Pure.
 */
export function canAccessDocument(doc: DocumentAccessShape, viewer: DocumentViewer): boolean {
  if (doc.addedById === viewer.userId) return true; // author always
  if (viewer.roles.includes("GUIDING_TEACHER")) return true; // sangha-wide reach
  if (doc.visibility === "COMMUNITY") return true; // every active member

  const hubIds = documentHubIds(doc);
  for (const m of viewer.memberships) {
    if (!hubIds.has(m.hubId)) continue;
    if (doc.visibility === "HUB") return true;
    if (doc.visibility === "COORDINATORS" && m.isCoordinator) return true;
  }
  return false;
}

/**
 * Can this viewer EDIT this document? Author, or a coordinator of any hub the
 * doc is placed in (GUIDING_TEACHER acts as coordinator everywhere). Edit
 * rights are role-driven and ignore `visibility`: a COMMUNITY doc is
 * community-*readable*, never community-*editable*. The lock (`isLocked`) is
 * enforced separately at the callsite — same as the native-doc PATCH route —
 * since only the author / ADMIN / GT may override a lock.
 */
export function canEditDocument(doc: DocumentAccessShape, viewer: DocumentViewer): boolean {
  if (doc.addedById === viewer.userId) return true;
  if (viewer.roles.includes("GUIDING_TEACHER")) return true;

  const hubIds = documentHubIds(doc);
  for (const m of viewer.memberships) {
    if (hubIds.has(m.hubId) && m.isCoordinator) return true;
  }
  return false;
}

/**
 * Async single-doc gate: loads the doc's access shape + the viewer's
 * memberships, then delegates to `canAccessDocument`. Returns null if the doc
 * doesn't exist (caller maps to 404).
 */
export async function canUserAccessDocument(
  documentId: string,
  userId: string,
  roles: string[],
): Promise<boolean | null> {
  const doc = await db.hubDocument.findUnique({
    where: { id: documentId },
    select: {
      addedById: true,
      hubId: true,
      visibility: true,
      placements: { select: { hubId: true } },
    },
  });
  if (!doc) return null;

  const memberships = await db.hubMember.findMany({
    where: { userId },
    select: { hubId: true, isCoordinator: true },
  });

  return canAccessDocument(doc, { userId, roles, memberships });
}
