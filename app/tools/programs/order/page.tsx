/**
 * /tools/programs/order — how each section of Programs & Events is ordered
 * (2026-10-28, Phase 3): the sections as visitors see them, with "Show first"
 * and Move up or down for the programs shown first. Everything else takes its
 * place by when it meets (lib/programOrder.ts).
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUsePrograms } from "@/lib/toolAuth";
import { loadPublicPrograms } from "@/lib/publicPrograms";
import { PUBLIC_CATEGORY_ORDER, categorySectionTitle } from "@/lib/programOffering";
import OrderClient from "@/components/programSetup/OrderClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "How each section is ordered - Programs" };

export default async function OrderPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();
  const programs = await loadPublicPrograms();
  const sections = PUBLIC_CATEGORY_ORDER.map((code) => ({
    code,
    title: categorySectionTitle(code) ?? code,
    programs: programs
      .filter((p) => p.offering.category === code)
      .map((p) => ({ slug: p.slug, name: p.name, when: p.dateText ?? "", first: p.listFirst })),
  })).filter((s) => s.programs.length > 0);
  return <OrderClient sections={sections} />;
}
