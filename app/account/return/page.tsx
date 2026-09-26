import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { authReturnPath } from "@/lib/authReturn";

// This route owns all gates so each can carry the original destination forward.
export default async function ReturnPage({ searchParams }: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;
  const returnTo = authReturnPath(to);
  const query = `returnTo=${encodeURIComponent(returnTo)}`;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?${query}`);
  if (!session.user.agreedToTerms) redirect(`/account/welcome?${query}`);
  if (session.user.archivedAt) redirect(`/account/reactivate?${query}`);
  redirect(returnTo);
}
