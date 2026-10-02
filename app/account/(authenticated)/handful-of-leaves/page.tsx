import HandfulReading from "@/components/HandfulReading";
import { loadHandfulDoc } from "@/lib/handfulContent";

export function generateMetadata() {
  return { title: `${loadHandfulDoc("introduction").title} - Rooted In Mindfulness` };
}

export default function HandfulIntroductionPage() {
  return <HandfulReading slug="introduction" />;
}
