import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LegacyImportClient from "@/components/LegacyImportClient";
import { pill } from "@/components/admin/DiagPill";

export const metadata = { title: "Import Memberstack Members - Admin" };
export const dynamic = "force-dynamic";

/**
 * Brings members who joined the old site into the app's quiet pool. ADMIN only.
 * Run now and again on the day the domain moves; then remove this page, its
 * route (/api/admin/import-legacy) and lib/legacyImport.
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

  const keySet = !!process.env.MEMBERSTACK_SECRET_KEY?.trim();

  return (
    <div className="adm-page adm-diag">
      <header className="ac-page-head">
        <div>
          <h1 className="ac-page-title">Import Memberstack members</h1>
          <p className="ac-page-sub">
            Brings in people who joined on the old site since the last import. Run it now and
            once more on the day the domain moves.
          </p>
        </div>
      </header>

      <div className="adm-diag__card">
        <div className="adm-diag__label">What it does</div>
        <p className="adm-diag__help">
          Only people who joined after the latest member already imported are brought in, so
          anyone removed since stays removed. Each new person becomes a quiet account: hidden
          from the main member list, sent no email, and kept until they sign in and accept the
          agreements themselves. Anyone already here is left exactly as they are. Suspected bots
          are left behind. Preview first; it writes nothing.
        </p>
      </div>

      {keySet ? (
        <LegacyImportClient />
      ) : (
        <div className="adm-diag__card">
          <div className="adm-diag__label">Memberstack key</div>
          <div className="adm-diag__row adm-diag__row--spaced">{pill("warning", "Not set")}</div>
          <p className="adm-diag__help">
            Add <code>MEMBERSTACK_SECRET_KEY</code> (the live secret key, starting <code>sk_</code>)
            to the Production environment in Vercel, then redeploy.
          </p>
        </div>
      )}
    </div>
  );
}
