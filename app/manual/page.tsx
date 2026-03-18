/**
 * /manual — Public volunteer manual (no auth required)
 * Renders identical content to /admin/manual via the shared ManualContent component.
 */
import ManualContent from "@/components/ManualContent";

export const metadata = { title: "Volunteer Manual — Rooted In Mindfulness" };

export default function PublicManualPage() {
  return <ManualContent isAdmin={false} />;
}
