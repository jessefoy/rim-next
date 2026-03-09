import { auth } from "@/auth";
import AccountSidebar from "@/components/AccountSidebar";

/**
 * AccountLayout — wraps all /account/* pages that need the sidebar.
 * Not applied to /account/welcome or /account/reactivate (standalone flows).
 *
 * Server component: fetches session once, passes roles to client sidebar.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles: string[] = session?.user?.roles ?? [];

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} />
      <div className="ac-content">{children}</div>
    </div>
  );
}
