import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HandfulReading from "@/components/HandfulReading";
import { loadHandfulDoc } from "@/lib/handfulContent";

export function generateMetadata() {
  return { title: `${loadHandfulDoc("map").title} - Rooted In Mindfulness` };
}

export default async function HandfulMapPage() {
  // Members only, checked here as well as in the layout: a page can render
  // without its layout re-running (2026-10-19 audit).
  if (!(await auth())) redirect("/login");
  return <HandfulReading slug="map" />;
}
