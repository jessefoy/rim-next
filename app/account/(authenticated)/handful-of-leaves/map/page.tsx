import HandfulReading from "@/components/HandfulReading";
import { loadHandfulDoc } from "@/lib/handfulContent";

export function generateMetadata() {
  return { title: `${loadHandfulDoc("map").title} - Rooted In Mindfulness` };
}

export default function HandfulMapPage() {
  return <HandfulReading slug="map" />;
}
