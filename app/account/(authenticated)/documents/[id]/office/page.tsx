import { auth } from "@/auth";
import OnlyOfficeEditor from "@/components/OnlyOfficeEditor";
import { canUserAccessDocument } from "@/lib/documentAuth";
import { redirect } from "next/navigation";

/**
 * Full-screen OnlyOffice editor for an office document. Doc-centric so it serves
 * documents that live in one hub, several, or none. Access is gated here
 * (server) and again when the client fetches the editor config.
 */
export default async function OfficeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await canUserAccessDocument(
    id,
    session.user.id,
    session.user.roles ?? [],
  );
  // null = not found, false = forbidden — either way, no editor.
  if (!access) redirect("/account");

  return (
    <div className="oo-fullscreen">
      <OnlyOfficeEditor documentId={id} />
    </div>
  );
}
