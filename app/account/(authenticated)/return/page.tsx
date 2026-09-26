import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { authReturnPath } from "@/lib/authReturn";

// The authenticated layout runs the usual membership and archive gates first.
export default async function ReturnPage({ searchParams }: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?returnTo=${encodeURIComponent(authReturnPath(to))}`);
  if (!session.user.agreedToTerms) redirect("/account/welcome");
  if (session.user.archivedAt) redirect("/account/reactivate");
  redirect(authReturnPath(to));
}
