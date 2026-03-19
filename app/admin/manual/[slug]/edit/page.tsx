import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import ManualSectionEditor from "@/components/ManualSectionEditor";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await db.manualSection.findUnique({ where: { slug }, select: { title: true } });
  return { title: `Edit: ${section?.title ?? "Section"} — Staff Manual` };
}

export default async function EditManualSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    redirect("/account/dashboard");
  }

  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) notFound();

  // Pre-render legacy Tiptap/rawHtml content to HTML for BlockNote import on mount
  const legacyBodyHtml = section.body && !Array.isArray(section.body)
    ? await renderContentBodyAsync(section.body)
    : null;

  return (
    <ManualSectionEditor
      slug={section.slug}
      initialTitle={section.title}
      initialHubSlug={section.hubSlug ?? ""}
      initialBody={section.body ?? null}
      legacyBodyHtml={legacyBodyHtml}
      initialRelations={section.relations}
      initialOrder={section.order}
    />
  );
}
