import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Authenticated-member route group layout.
 *
 * Every route under `app/account/(authenticated)/` is gated by this layout.
 * Three checks, all server-side, all reading enriched session fields (no
 * extra DB query):
 *
 *   1. A session must exist. No session → /login.
 *   2. The session's user must have completed the community care agreements
 *      (agreedToTerms: true). If false → /account/welcome (where they
 *      complete the threshold ritual and land in the dashboard on submit).
 *   3. The session's user must not be archived (archivedAt is null). If
 *      archived → /account/reactivate (where they can reactivate with
 *      one click and continue to the dashboard).
 *
 * `agreedToTerms` and `archivedAt` are enriched onto `session.user` in
 * auth.ts's session callback, so all three checks are JWT reads.
 *
 * Why this is a layout, not per-page guards:
 *
 *   Putting all three gates at the layout level is structural — any
 *   route added under (authenticated)/ is automatically gated, can't
 *   drift on a forgotten guard call. This is the canonical Next.js
 *   App Router pattern for shared auth gating. The route group `()` is
 *   URL-invisible, so /account/dashboard etc. work unchanged.
 *
 *   Prior to session 132 these checks were claimed (in FEATURES.md §14
 *   and the FEATURES.md "Account Archival" section) to live in
 *   `proxy.ts`. They didn't — proxy.ts is a no-op (NextAuth v5 with the
 *   Prisma adapter can't verify sessions in the Edge runtime). And no
 *   per-page guards enforced them either. Result: a first-time visitor
 *   could sign in via /login and land on /account/dashboard without
 *   ever agreeing to the community care agreements; an archived member
 *   could sign in and reach the dashboard without going through the
 *   reactivation flow. This layout closes both gaps structurally.
 *
 * What stays OUTSIDE this group (intentionally):
 *
 *   - /account/welcome — un-agreed users land here to complete the
 *     threshold ritual. If it were inside the group, redirect-to-welcome
 *     would loop forever.
 *   - /account/reactivate — archived members complete reactivation here.
 *     If it were inside the group, redirect-to-reactivate would loop.
 *
 * Both still call `auth()` themselves to ensure a session exists (they're
 * outside the layout's session check). They check the specific state they
 * handle (welcome checks agreedToTerms, reactivate checks archivedAt) and
 * redirect to /account/dashboard when the state no longer applies.
 */
export default async function AuthenticatedAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!session.user.agreedToTerms) {
    redirect("/account/welcome");
  }
  if (session.user.archivedAt) {
    redirect("/account/reactivate");
  }
  return <>{children}</>;
}
