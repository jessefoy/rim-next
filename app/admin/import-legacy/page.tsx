import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LegacyImportClient from "@/components/LegacyImportClient";

export const metadata = { title: "Import legacy members — Admin" };
export const dynamic = "force-dynamic";

/**
 * One-time Memberstack migration tool. ADMIN-only. Remove this page, its route
 * (/api/admin/import-legacy), and lib/legacyImport once the import is complete.
 */
export default async function ImportLegacyPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header">
          <p className="lp-label">Admin</p>
          <h1 className="adm-header__title">Import legacy members</h1>
          <p className="adm-header__count">One-time Memberstack migration</p>
        </header>
        <LegacyImportClient />
      </div>
    </div>
  );
}
