/**
 * Admin layout — shared shell for all /admin/* routes.
 * Sets UI font scale: 16px / 1.55 (product/task context).
 * Reading content inside admin pages (.rim-content) overrides back to 18px.
 */

import AccountLayout from "@/components/AccountLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountLayout>
      <div className="admin-ui">
        {children}
      </div>
    </AccountLayout>
  );
}
