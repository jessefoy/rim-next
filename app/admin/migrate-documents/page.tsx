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
              Run the dry-run to see what moves. &ldquo;Migrate 2 (test)&rdquo;
              copies two docs so you can eyeball them in Files first;
              &ldquo;Migrate all remaining&rdquo; does the rest. Native
              documents stay intact — this only creates the Google copies.
            </p>
          </div>
        </div>
        <MigrateDocumentsClient />
      </div>
    </div>
  );
}
