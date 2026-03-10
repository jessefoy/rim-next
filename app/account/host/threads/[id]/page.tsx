import { redirect } from "next/navigation";

// Redirect: Threads are now Conversations
export default async function OldThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/account/host/conversations/${id}`);
}
