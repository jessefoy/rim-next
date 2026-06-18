import type { PageContent } from "@/lib/pageBuilder/types";
import { PageRenderer } from "@/components/PageRenderer";

// TEMPORARY prototype preview route — verifies the page-builder render pipeline
// on a Vercel deploy. Remove before merging to main.
const FIXTURE: PageContent = {
  version: 1,
  sections: [
    {
      id: "s1",
      type: "hero",
      variant: "centered",
      style: { background: "blue", spaceBottom: "l" },
      props: {
        eyebrow: "Welcome",
        title: "A community of practice",
        subtitle: "Live online sits, courses, and dharma — open to all.",
        buttonLabel: "Explore programs",
        buttonHref: "/community-programs",
      },
    },
    {
      id: "s2",
      type: "richText",
      style: { width: "reading", spaceTop: "l", spaceBottom: "l" },
      props: {
        html:
          "<h2>Practicing together</h2><p>Rooted in Mindfulness is a warm, welcoming sangha offering live online meditation, dharma study, and courses in the Insight tradition. Whether you sit every day or are just beginning, there is a place for you here.</p>",
      },
    },
    {
      id: "s3",
      type: "cardGrid",
      variant: "three",
      style: { background: "dawn", spaceTop: "l", spaceBottom: "l" },
      props: {
        heading: "What you'll find here",
        cards: [
          { title: "Drop-in sits", body: "Daily online meditation, open to everyone.", href: "/this-week", linkLabel: "See the schedule" },
          { title: "Courses", body: "Structured study, at your own pace.", href: "/courses", linkLabel: "Browse courses" },
          { title: "Community", body: "Find your people in practice.", href: "/join", linkLabel: "Become a member" },
        ],
      },
    },
    {
      id: "s4",
      type: "cta",
      style: { background: "blue", spaceTop: "l" },
      props: { heading: "Begin where you are.", buttonLabel: "Join", buttonHref: "/join" },
    },
  ],
};

export default function PagePreviewPage() {
  return <PageRenderer content={FIXTURE} />;
}
