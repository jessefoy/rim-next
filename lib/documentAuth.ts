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

/** The viewer's identity + their active hub memberships. */
export interface DocumentViewer {
  userId: string;
  roles: string[];
  memberships: { hubId: string; isCoordinator: boolean; status: string }[];
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
 * view and the master directory. Pure.
 */
export function canAccessDocument(doc: DocumentAccessShape, viewer: DocumentViewer): boolean {
  if (doc.addedById === viewer.userId) return true; // author always
  if (viewer.roles.includes("GUIDING_TEACHER")) return true; // sangha-wide reach
  if (doc.visibility === "COMMUNITY") return true; // every active member

  const hubIds = documentHubIds(doc);
  for (const m of viewer.memberships) {
    if (m.status !== "ACTIVE") continue;
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
    if (m.status !== "ACTIVE") continue;
    if (hubIds.has(m.hubId) && m.isCoordinator) return true;
  }
  return false;
}

/**
 * Can this viewer manage the document's SHARING LIFECYCLE — change its
 * visibility, or share it OUT into more hubs? Origin owns the lifecycle
 * (RIM_Documents.md §7): the author, a coordinator of the ORIGIN hub, or
 * GUIDING_TEACHER. A coordinator of a hub the doc was merely *shared into* does
 * NOT qualify — their only management action is removing their own hub's
 * placement (`canRemovePlacement`). Hubless docs (no origin) are author/GT-only.
 *
 * This is deliberately stricter than `canEditDocument` (which lets any
 * placed-in-hub coordinator edit content): editing the body is a hub-team act;
 * re-scoping who can reach the doc is the origin's call.
 */
export function canManageDocumentSharing(doc: DocumentAccessShape, viewer: DocumentViewer): boolean {
  if (doc.addedById === viewer.userId) return true;
  if (viewer.roles.includes("GUIDING_TEACHER")) return true;
  if (doc.hubId === null) return false; // hubless project doc: author / GT only
  return viewer.memberships.some((m) => m.status === "ACTIVE" && m.hubId === doc.hubId && m.isCoordinator);
}

/**
 * Can this viewer remove the document's placement in `hubId`? The origin side
 * (`canManageDocumentSharing`) can remove any placement; additionally, a
 * coordinator of the specific hub being removed can drop *that hub's* placement
 * — a team declining a doc shared to it. This is the one cross-hub sharing
 * action a shared-into hub's coordinator may take.
 */
export function canRemovePlacement(doc: DocumentAccessShape, viewer: DocumentViewer, hubId: string): boolean {
  if (canManageDocumentSharing(doc, viewer)) return true;
  return viewer.memberships.some((m) => m.status === "ACTIVE" && m.hubId === hubId && m.isCoordinator);
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
    where: { userId, status: "ACTIVE" },
    select: { hubId: true, isCoordinator: true, status: true },
  });

  return canAccessDocument(doc, { userId, roles, memberships });
}

/**
 * The set of document ids within a hub the viewer can OPEN — for list/activity
 * surfaces that render many of a hub's docs and must hide the ones the viewer
 * can't reach (the COORDINATORS-visibility case). Loads the hub's doc access
 * shapes + the viewer's memberships once, filters in memory — never per-doc.
 *
 * Hub-scoped on purpose: every doc surfaced in a hub's own lists/activity has
 * that hub among its placement set, so a doc whose origin is this hub is the
 * unit these surfaces show.
 */
export async function accessibleHubDocumentIds(
  hubId: string,
  userId: string,
  roles: string[],
): Promise<Set<string>> {
  const [docs, memberships] = await Promise.all([
    db.hubDocument.findMany({
      where:  { hubId, deletedAt: null },
      select: { id: true, addedById: true, hubId: true, visibility: true, placements: { select: { hubId: true } } },
    }),
    db.hubMember.findMany({
      where:  { userId, status: "ACTIVE" },
      select: { hubId: true, isCoordinator: true, status: true },
    }),
  ]);
  const viewer = { userId, roles, memberships };
  return new Set(docs.filter((d) => canAccessDocument(d, viewer)).map((d) => d.id));
}
