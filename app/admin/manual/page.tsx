import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ManualContent from "@/components/ManualContent";

export const metadata = { title: "Volunteer Manual — Rooted In Mindfulness" };

export default async function ManualPage() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "REGISTRAR", "HOST", "HOST_MANAGER", "TEACHER", "SUPPORT"].includes(r))) {
    redirect("/login");
  }

  const isAdmin = session.user.roles?.includes("ADMIN") ?? false;

  return <ManualContent isAdmin={isAdmin} />;
}
