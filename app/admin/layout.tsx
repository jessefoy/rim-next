/**
 * Admin layout — shared shell for all /admin/* routes.
 * Sets UI font scale: 16px / 1.55 (product/task context).
 * Reading content inside admin pages (.rim-content) overrides back to 18px.
 */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-ui">
      {children}
    </div>
  );
}
