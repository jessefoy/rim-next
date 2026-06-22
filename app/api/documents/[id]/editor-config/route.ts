import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessDocument, canEditDocument } from "@/lib/documentAuth";
import { buildEditorConfig, onlyOfficeConfigured, requestBaseUrl } from "@/lib/onlyoffice";
import { NextResponse } from "next/server";

// Office-file extension for the HubDocumentFileType enum.
const EXT_FOR_FILETYPE: Record<string, string> = {
  DOC: "docx",
  SHEET: "xlsx",
  SLIDE: "pptx",
  FORM: "docx",
};

/**
 * GET — build the JWT-signed OnlyOffice editor config for this document.
 *
 * Doc-centric (NOT under /api/hub/[slug]), because an office doc can live in
 * one hub, several, or none — access is resolved by `canAccessDocument` over
 * the doc's placements + visibility, not a single hub slug.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!onlyOfficeConfigured()) {
    return NextResponse.json({ error: "OnlyOffice is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const doc = await db.hubDocument.findUnique({
    where: { id },
    select: {
      id: true,
      addedById: true,
      hubId: true,
      visibility: true,
      docKind: true,
      fileType: true,
      version: true,
      label: true,
      isLocked: true,
      archivedAt: true,
      deletedAt: true,
      storageKey: true,
      placements: { select: { hubId: true } },
    },
  });
  if (!doc || !doc.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.docKind !== "ONLYOFFICE") {
    return NextResponse.json({ error: "Not an OnlyOffice document" }, { status: 400 });
  }

  const roles = session.user.roles ?? [];
  const memberships = await db.hubMember.findMany({
    where: { userId: session.user.id },
    select: { hubId: true, isCoordinator: true },
  });
  const viewer = { userId: session.user.id, roles, memberships };

  if (!canAccessDocument(doc, viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Edit requires write access AND the doc is live AND (not locked, or the
  // viewer can override the lock — author / ADMIN / GUIDING_TEACHER).
  const isAuthor = doc.addedById === session.user.id;
  const canOverrideLock =
    isAuthor || roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER");
  const readOnly = Boolean(
    doc.archivedAt || doc.deletedAt || (doc.isLocked && !canOverrideLock),
  );
  const canEdit = canEditDocument(doc, viewer) && !readOnly;

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, preferredName: true },
  });
  const displayName =
    me?.preferredName?.trim() ||
    [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim() ||
    "RIM member";

  const ext = EXT_FOR_FILETYPE[doc.fileType] ?? "docx";

  const built = buildEditorConfig(
    {
      documentId: doc.id,
      version: doc.version,
      fileType: ext,
      title: `${doc.label}.${ext}`,
      canEdit,
      user: { id: session.user.id, name: displayName },
    },
    requestBaseUrl(req),
  );

  return NextResponse.json(built);
}
