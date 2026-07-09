/**
 * /account/documents — the master document directory (RIM_Documents.md §6).
 *
 * "Find a doc across all my teams without remembering which hub." Sections are
 * the viewer's own hubs (each holding its accessible docs), then Community
 * (accessible docs reached community-wide, outside the viewer's hubs), then
 * Projects (hubless docs). Search spans everything; recency-first within each
 * section. Access rides on the pure, placement-aware canAccessDocument.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessDocument } from "@/lib/documentAuth";
import DocumentsDirectoryClient from "@/components/DocumentsDirectoryClient";
import AccountLayout from "@/components/AccountLayout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

function authorName(u: { firstName: string | null; lastName: string | null; preferredName: string | null }) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

export default async function DocumentsDirectoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isGT = roles.includes("GUIDING_TEACHER");

  const memberships = await db.hubMember.findMany({
    where:  { userId },
    select: {
      hubId: true,
      isCoordinator: true,
      status: true,
      hub: { select: { id: true, slug: true, name: true, status: true } },
    },
  });
  const myActiveHubs = memberships.filter((m) => m.status === "ACTIVE" && m.hub.status === "ACTIVE");
  const myHubIds = myActiveHubs.map((m) => m.hubId);
  const myHubById = new Map(myActiveHubs.map((m) => [m.hubId, m.hub]));

  // A superset of accessible ACTIVE docs, then trimmed by the pure
  // canAccessDocument (which honors the COORDINATORS-visibility nuance). GT
  // reaches everything, so it gets all active docs as candidates.
  const candidates = await db.hubDocument.findMany({
    where: {
      deletedAt:  null,
      archivedAt: null,
      ...(isGT
        ? {}
        : {
            OR: [
              { addedById: userId },
              { visibility: "COMMUNITY" },
              { hubId: { in: myHubIds } },
              { placements: { some: { hubId: { in: myHubIds } } } },
            ],
          }),
    },
    include: {
      addedBy:    { select: { firstName: true, lastName: true, preferredName: true } },
      hub:        { select: { id: true, slug: true, name: true } },
      placements: { include: { hub: { select: { id: true, slug: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const viewer = {
    userId,
    roles,
    // Use the same active-hub set the candidate query used, so the filter and
    // query agree: paused memberships do not grant document access.
    memberships: myActiveHubs.map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator, status: m.status })),
  };
  const accessible = candidates.filter((d) => canAccessDocument(d, viewer));

  // ── Section the docs: the viewer's hubs, then Community, then Projects ──────
  function serializeDoc(
    d: (typeof accessible)[number],
    sectionHub: { id: string; slug: string; name: string } | null,
  ) {
    const external = d.docKind === "LINK" || d.docKind === "UPLOAD";
    const href = external
      ? (d.url ?? "#")
      : sectionHub
        ? `/account/hub/${sectionHub.slug}/documents/${d.id}`
        : `/account/documents/${d.id}`;
    return {
      id:          d.id,
      label:       d.label,
      description: d.description,
      docKind:     d.docKind,
      fileType:    d.fileType,
      category:    d.category,
      updatedAt:   d.updatedAt.toISOString(),
      author:      authorName(d.addedBy),
      visibility:  d.visibility,
      // "Shared from X" when surfaced in a hub that isn't the doc's origin.
      originName: sectionHub && d.hub && d.hub.id !== sectionHub.id ? d.hub.name : null,
      href,
      external,
    };
  }
  type DirDoc = ReturnType<typeof serializeDoc>;

  const hubSections = new Map<string, { hub: { id: string; slug: string; name: string }; docs: DirDoc[] }>();
  const community: DirDoc[] = [];
  const projects: DirDoc[] = [];

  for (const d of accessible) {
    const docHubIds = [...new Set(
      [d.hubId, ...d.placements.map((p) => p.hubId)].filter((x): x is string => Boolean(x)),
    )];
    const myMatching = docHubIds.filter((hid) => myHubById.has(hid));
    if (myMatching.length > 0) {
      for (const hid of myMatching) {
        const hub = myHubById.get(hid)!;
        if (!hubSections.has(hid)) hubSections.set(hid, { hub, docs: [] });
        hubSections.get(hid)!.docs.push(serializeDoc(d, hub));
      }
    } else if (docHubIds.length === 0) {
      projects.push(serializeDoc(d, null));
    } else {
      community.push(serializeDoc(d, null));
    }
  }

  const sections = [
    ...[...hubSections.values()]
      .sort((a, b) => a.hub.name.localeCompare(b.hub.name))
      .map((s) => ({ key: `hub-${s.hub.id}`, label: s.hub.name, docs: s.docs })),
    ...(community.length ? [{ key: "community", label: "Community", docs: community }] : []),
    ...(projects.length  ? [{ key: "projects",  label: "Projects",  docs: projects  }] : []),
  ];

  return (
    <AccountLayout>
      <DocumentsDirectoryClient sections={sections} />
    </AccountLayout>
  );
}
