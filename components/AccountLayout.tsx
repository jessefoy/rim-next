import { auth } from "@/auth";
import AccountSidebar from "@/components/AccountSidebar";

/**
 * AccountLayout — wraps all /account/* pages that need the sidebar.
 * Not applied to /account/welcome or /account/reactivate (standalone flows).
 *
 * Server component: fetches roles for contextual administration navigation.
 * Team membership is resolved on the My Teams directory, not every page.
 */
export default async function AccountLayout({
  children,
  suppressSidebar = false,
}: {
  children: React.ReactNode;
  /** When true, hides the sidebar and renders content full-width. Used by hub pages. */
  suppressSidebar?: boolean;
}) {
  const session = await auth();
  const roles: string[] = session?.user?.roles ?? [];

  if (suppressSidebar) {
    return (
      <div className="ac-layout ac-layout--no-sidebar">
        <div className="ac-content">
          <div className="ac-inner">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-layout">
      <AccountSidebar roles={roles} />
      <div className="ac-content">
        <div className="ac-inner">{children}</div>
      </div>
    </div>
  );
}
