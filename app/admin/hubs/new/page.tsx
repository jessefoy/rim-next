import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HubAdminForm from "@/components/HubAdminForm";

export const metadata = { title: "Create Hub — Admin" };

export default async function AdminHubNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.includes("ADMIN");
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
        <h1 className="adm-hubs-title">Create Hub</h1>
        <HubAdminForm isEditing={false} />
      </div>
    </div>
  );
}
