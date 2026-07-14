import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import EmailTemplateEditor from "@/components/EmailTemplateEditor";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = await db.emailTemplate.findUnique({ where: { slug }, select: { name: true } });
  return { title: t ? `Edit: ${t.name}` : "Email Template" };
}

export default async function EmailTemplateEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/account/dashboard");

  const { slug } = await params;
  const template = await db.emailTemplate.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      subject: true,
      body: true,
      enabled: true,
      variables: true,
      helpText: true,
      sanityNote: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!template) notFound();

  const userId = (session.user as { id?: string }).id ?? "";

  return (
    <EmailTemplateEditor
      template={{
        ...template,
        helpText: template.helpText ?? null,
        sanityNote: template.sanityNote ?? null,
        updatedAt: template.updatedAt.toISOString(),
        updatedBy: template.updatedBy
          ? `${template.updatedBy.firstName ?? ""} ${template.updatedBy.lastName ?? ""}`.trim()
          : null,
      }}
      userId={userId}
    />
  );
}
