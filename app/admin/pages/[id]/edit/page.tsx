import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageComposer } from "@/components/page-composer/PageComposer";
import { EMPTY_PAGE_CONTENT, type PageContent } from "@/lib/pageBuilder/types";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/account/dashboard");

  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  // Guard the stored JSON shape; fall back to an empty document if malformed.
  const raw = page.content as unknown;
  const content: PageContent =
    raw && typeof raw === "object" && Array.isArray((raw as { sections?: unknown }).sections)
      ? (raw as PageContent)
      : EMPTY_PAGE_CONTENT;

  return (
    <PageComposer
      pageId={page.id}
      slug={page.slug}
      initialTitle={page.title}
      initialStatus={page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
      initialContent={content}
    />
  );
}
