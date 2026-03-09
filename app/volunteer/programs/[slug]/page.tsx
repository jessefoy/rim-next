import { redirect } from "next/navigation";

export default async function OldVolunteerProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/account/registrar/${slug}`);
}
