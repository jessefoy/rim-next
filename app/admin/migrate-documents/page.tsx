import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MigrateDocumentsClient from "@/components/MigrateDocumentsClient";

export const metadata = { title: "Migrate Documents — Admin" };
export const dynamic = "force-dynamic";

export default async function MigrateDocumentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.roles?.includes("ADMIN")) {
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
        <div className="ac-page-head">
          <div>
            <h1 className="ac-page-title">Migrate native documents to Google Files</h1>
            <p className="ac-page-sub">
              The dry-run reports what would move — nothing is written until we
              build and run the migrate step. Native documents stay untouched.
            </p>
          </div>
        </div>
        <MigrateDocumentsClient />
      </div>
    </div>
  );
}
