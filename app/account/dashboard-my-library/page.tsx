import ListRow from "@/components/ListRow";

export const metadata = { title: "My Library — Rooted In Mindfulness" };

const LIBRARY_ITEMS = [
  {
    name: "Glossary of Dharma Terms",
    href: undefined,
    label: "Coming Soon",
    disabled: true,
    external: false,
  },
  {
    name: "Four Foundations of Mindfulness (Satipatthana) Sutta",
    href: "https://www.rootedinmindfulness.org/course/satipatthana-sutta",
    label: "Go →",
    disabled: false,
    external: true,
  },
  {
    name: "Loving-Kindness (Metta) Sutta",
    href: "/lessons/metta-sutta",
    label: "Go →",
    disabled: false,
    external: false,
  },
  {
    name: "Handful of Leaves Learning and Practice Resources",
    href: "/course/essential-dharma-study-resources",
    label: "Go →",
    disabled: false,
    external: false,
  },
];

export default function MyLibraryPage() {
  return (
    <div className="page-wrapper">
      <div className="dashboard-section">
        <div className="dashboard-content">
          <h1 className="heading-11">Learning and Practice Support</h1>
          <p className="paragraph-17-copy">
            The following are links to the learning and practice resources associated with your
            activities at RIM. <br />
            <strong>Please Note:</strong> This page is still a work in progress and subject to
            change ;)
          </p>
          {LIBRARY_ITEMS.map((item) => (
            <ListRow
              key={item.name}
              title={item.name}
              href={item.href}
              buttonLabel={item.label}
              disabled={item.disabled}
              external={item.external}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
